import type { Pool, PoolClient } from "pg";

// Shared FK-safe deletion routine for "erase everything one or more users
// own." Used two ways:
//   - db/scripts/reset-user-data.ts (BUG-01): userId omitted -> wipes every
//     app_user and everything hanging off them, leaving catalog.*/content.*
//     (curriculum) completely untouched.
//   - backend/src/controllers/demoController.ts (BUG-02): userId passed ->
//     wipes just that one account, called at the start of every "Quick Demo"
//     login so the account is always fresh.
// One function instead of two copies of the same FK graph, since the two
// callers must never drift out of sync with each other or with a future
// migration that adds another user-owned table.
//
// Order matters: children before parents, matching the FK edges in
// db/migrations/{002_core,004_assess,005_learn,018_test_engine,020_attempt_question,022_core_user_session}.sql.
// Content tables (catalog.*, content.*, learn.unit_material) are never
// touched here — see the "must not delete content" rule in
// docs/assessment-tool-debug-plan.md's BUG-01 spec.
export interface WipeResult {
  counts: { [table: string]: number };
  // Supabase Auth identities (auth.users) behind the app_user rows just
  // deleted. core.app_user has no authority over auth.users — the caller
  // must delete these separately via the Supabase Admin API, or the same
  // email/phone can never sign up again (core.app_user's unique constraint
  // would collide with the still-alive Auth identity on the next
  // provisionCanonicalUser() call). Captured before the delete, since
  // core.app_user itself is gone by the time this function returns.
  authUserIds: string[];
}

export async function wipeUserOwnedData(
  pool: Pool,
  opts: {
    userId?: string;
    /**
     * Wipe EVERY user's owned data (unscoped, like a full wipe) but keep all
     * core.app_user rows and their profiles. Added for
     * db/scripts/prune-users.ts, which wipes all data but only removes some
     * accounts.
     *
     * This is not the same as looping the single-user path over every user,
     * and the difference is a real FK bug rather than a preference: a
     * per-user call deletes that user's generated assess.test/test_section
     * rows, but assess.section_score rows belonging to a DIFFERENT user's
     * attempt on that same shared test still reference them, so the delete
     * fails with fk_section_score_test_section_id (23503). Found live running
     * exactly that loop. Running the deletes unscoped removes every
     * section_score before any test_section, so the ordering already encoded
     * in this function is correct again.
     */
    keepIdentities?: boolean;
  } = {}
): Promise<WipeResult> {
  const { userId, keepIdentities = false } = opts;
  const client: PoolClient = await pool.connect();
  const counts: { [table: string]: number } = {};

  const run = async (table: string, sql: string, params: unknown[] = []): Promise<void> => {
    const res = await client.query(sql, params);
    counts[table] = (counts[table] ?? 0) + (res.rowCount ?? 0);
  };

  // Scoping fragment: with a userId, every delete is filtered to that one
  // user's rows (via a subquery where the table itself has no user_id
  // column); without one, every delete runs unfiltered (full wipe).
  const scoped = (whereUserCol: string) => (userId ? `where ${whereUserCol} = $1` : "");
  const params = userId ? [userId] : [];

  try {
    await client.query("begin");

    // Only needed for a full wipe — a single-user call keeps its app_user
    // row (see the core.* section below), so there's no Auth identity to
    // hand back to the caller for deletion.
    let authUserIds: string[] = [];
    if (!userId && !keepIdentities) {
      const authRowsRes = await client.query<{ auth_user_id: string }>(`select auth_user_id from core.app_user`);
      authUserIds = authRowsRes.rows.map((r) => r.auth_user_id);
    }

    // --- learn.* (children first) ---
    await run(
      "learn.error_log",
      `delete from learn.error_log ${userId ? "where user_id = $1" : ""}`,
      params
    );
    await run(
      "learn.flashcard_review",
      `delete from learn.flashcard_review where flashcard_id in (
         select flashcard_id from learn.flashcard ${scoped("user_id")}
       )`,
      params
    );
    await run("learn.flashcard", `delete from learn.flashcard ${scoped("user_id")}`, params);
    await run("learn.study_session", `delete from learn.study_session ${scoped("user_id")}`, params);
    await run(
      "learn.plan_task",
      `delete from learn.plan_task where plan_id in (
         select plan_id from learn.study_plan ${scoped("user_id")}
       )`,
      params
    );
    // learn.study_plan_goal cascades from learn.study_plan (on delete
    // cascade, 026_learn_study_tools.sql) — not a separate run() call.
    await run("learn.study_plan", `delete from learn.study_plan ${scoped("user_id")}`, params);
    // Phase 7 (BUG-20/21/22, 026_learn_study_tools.sql) — custom_task,
    // revision_note, pomodoro_session all have a direct user_id column, same
    // shape as flashcard/study_session above. pomodoro_session.task_id is
    // "on delete set null" (not cascade) against custom_task, so deleting it
    // first isn't strictly required, but keeping the same "child before
    // parent" order as everywhere else in this function avoids having to
    // reason about it case by case.
    await run("learn.pomodoro_session", `delete from learn.pomodoro_session ${scoped("user_id")}`, params);
    await run("learn.custom_task", `delete from learn.custom_task ${scoped("user_id")}`, params);
    await run("learn.revision_note", `delete from learn.revision_note ${scoped("user_id")}`, params);
    await run("learn.notification", `delete from learn.notification ${scoped("user_id")}`, params);
    // Found live in the same pg_constraint sweep as the ai_generation_job/
    // import_batch/question_review/invitation gaps below — learn.
    // topic_mastery (005_learn.sql) had a NOT NULL user_id FK and was never
    // deleted here at all, not even nulled. Unlike those four, this is
    // genuinely user-owned data (per-user topic mastery tracking), so it's
    // deleted outright, same as every other learn.* table above.
    await run("learn.topic_mastery", `delete from learn.topic_mastery ${scoped("user_id")}`, params);
    await run(
      "learn.audit_log",
      `delete from learn.audit_log where actor_user_id ${userId ? "= $1" : "is not null"}`,
      params
    );

    // --- assess.* (children first) ---
    await run(
      "assess.section_score",
      `delete from assess.section_score where scorecard_id in (
         select sc.scorecard_id from assess.scorecard sc
         join assess.attempt a on a.attempt_id = sc.attempt_id
         ${scoped("a.user_id")}
       )`,
      params
    );
    await run(
      "assess.scorecard",
      `delete from assess.scorecard where attempt_id in (
         select attempt_id from assess.attempt ${scoped("user_id")}
       )`,
      params
    );
    await run(
      "assess.attempt_response",
      `delete from assess.attempt_response where attempt_id in (
         select attempt_id from assess.attempt ${scoped("user_id")}
       )`,
      params
    );
    await run(
      "assess.attempt_event",
      `delete from assess.attempt_event where attempt_id in (
         select attempt_id from assess.attempt ${scoped("user_id")}
       )`,
      params
    );
    // assess.attempt_question and assess.attempt_pause both cascade from
    // assess.attempt (on delete cascade, 020_attempt_question.sql /
    // 018_test_engine.sql) — deleting assess.attempt below removes them too;
    // not listed as separate `run()` calls since there's nothing left to
    // delete once the parent is gone.
    // content.question_usage — added by migration 040 (Layer 4 of
    // question-dedup-audit-and-fix.md), which is newer than this routine, so
    // this routine did not know about it. It IS user-owned, attempt-derived
    // data: one row per question per generated paper, keyed on the attempt.
    // Found live by a wipe that left 2,460 usage rows pointing at attempts
    // that no longer existed.
    //
    // Deleted BEFORE assess.attempt so paper_id still resolves while the
    // scoped subquery runs. There is no FK from paper_id to assess.attempt,
    // so nothing forces this ordering — hence the explicit note.
    //
    // Deleting these rows also fires content.trg_question_usage_count, which
    // decrements content.question.usage_count back down. That is correct and
    // is why usage_count is not reset separately: the counter is derived from
    // these rows, so removing the history removes the count with it.
    await run(
      "content.question_usage",
      userId
        ? `delete from content.question_usage where user_id = $1 or paper_id in (select attempt_id from assess.attempt where user_id = $1)`
        : `delete from content.question_usage`,
      params
    );

    await run("assess.attempt", `delete from assess.attempt ${scoped("user_id")}`, params);
    await run("assess.user_question_seen", `delete from assess.user_question_seen ${scoped("user_id")}`, params);
    await run("assess.idempotency_key", `delete from assess.idempotency_key ${scoped("user_id")}`, params);
    await run(
      "assess.test_assignment",
      `delete from assess.test_assignment ${userId ? "where user_id = $1" : "where user_id is not null"}`,
      params
    );

    // Generated (per-session) test shells this user's own attempts created —
    // never an authored/pyq paper, which is shared content, not user data.
    // assess.test.source_type: 'authored' | 'pyq' | 'generated' (018_test_engine.sql).
    const ownTestsWhere = userId ? "created_by = $1 and source_type = 'generated'" : "source_type = 'generated'";
    await run(
      "assess.test_question",
      `delete from assess.test_question where test_section_id in (
         select test_section_id from assess.test_section where test_id in (
           select test_id from assess.test where ${ownTestsWhere}
         )
       )`,
      params
    );
    // assess.test_blueprint cascades from test_section (on delete cascade).
    await run(
      "assess.test_section",
      `delete from assess.test_section where test_id in (
         select test_id from assess.test where ${ownTestsWhere}
       )`,
      params
    );
    await run("assess.test", `delete from assess.test where ${ownTestsWhere}`, params);

    // Real gap found live: an 'authored'/'pyq' test (a shared curriculum
    // paper, correctly left alone by ownTestsWhere above) still points its
    // created_by at whoever made it — a full wipe deleting that user hit
    // fk_test_created_by (23503) before this existed. Migration 035 made
    // the column nullable; only a full wipe nulls it (a single-user reset
    // keeps its own app_user row, so nothing is dangling), same
    // preserve-the-content/sever-the-attribution shape as the four
    // content.*/core.invitation columns below.
    if (!userId && !keepIdentities) {
      await run("assess.test (created_by nulled)", `update assess.test set created_by = null where created_by is not null`);
    }

    // --- core.* (children first, app_user last) ---
    await run("core.user_session", `delete from core.user_session ${scoped("user_id")}`, params);
    await run("core.batch_member", `delete from core.batch_member ${scoped("user_id")}`, params);
    await run("core.subscription", `delete from core.subscription ${scoped("user_id")}`, params);
    await run("core.enrollment", `delete from core.enrollment ${scoped("user_id")}`, params);

    // The identity shell (app_user + its profile rows) is only deleted on a
    // full wipe (BUG-01's literal "delete all the users"). A single-user
    // call (BUG-02's demo reset) deliberately keeps it: requireAuth's
    // provisionCanonicalUser upserts core.app_user keyed by auth_user_id, so
    // deleting and letting it re-insert on the very next request would mint
    // a brand-new user_id/member_code and re-fire "first login" side effects
    // (a fresh core.user_role_assignment row, a 'user_provisioned' audit row,
    // a duplicate "Welcome to Lumen Academy!" notification) on every single
    // demo login — churn the bug never asked for. Clearing this account's
    // *owned data* while keeping its identity stable is the actual ask.
    if (!userId && !keepIdentities) {
      // Found live running a real full wipe: four more FKs into
      // core.app_user that this function didn't know about, on tables it
      // deliberately never deletes from (content.*/core.invitation are
      // audit/provenance records, not user-owned data) — the first attempt
      // hit fk_ai_generation_job_requested_by immediately (23503, rolled
      // back cleanly, nothing lost); a full pg_constraint sweep afterward
      // found three more of the same shape that would have broken the next
      // attempt. Migration 034 made all four nullable; nulling them here
      // (only on a full wipe — a single-user reset keeps its own app_user
      // row, so there's no dangling pointer to sever) preserves the audit
      // rows themselves while severing the now-dead reference, same
      // ON DELETE SET NULL semantics this schema already uses for
      // core.user_role_assignment.granted_by (009_core_rbac.sql).
      await run("content.ai_generation_job (requested_by nulled)", `update content.ai_generation_job set requested_by = null where requested_by is not null`);
      await run("content.import_batch (submitted_by nulled)", `update content.import_batch set submitted_by = null where submitted_by is not null`);
      await run("content.question_review (reviewer_user_id nulled)", `update content.question_review set reviewer_user_id = null where reviewer_user_id is not null`);
      await run("core.invitation (invited_by nulled)", `update core.invitation set invited_by = null where invited_by is not null`);

      await run("core.student_profile", `delete from core.student_profile`);
      await run("core.educator_profile", `delete from core.educator_profile`);
      await run("core.app_user", `delete from core.app_user`);

      // Real gap found live, the hard way: after a full wipe + demo re-seed,
      // the very next demo login failed with a raw 23505 on
      // "users_email_key" inside provisionCanonicalUser. public.users
      // (backend/src/services/provisionUser.service.ts's Prisma-track
      // identity row, keyed by the same Supabase auth id as
      // core.app_user.auth_user_id, own header comment: "not this phase's
      // call to retire... that surface belongs to other engineers") was
      // never part of this function's FK graph at all. The re-seeded demo
      // account gets a brand-new auth id, so `on conflict (id)` in that
      // insert never matched the OLD row still sitting here under the same
      // email — it fell through to a genuine insert and hit the table's
      // separate UNIQUE(email) constraint instead. Its child tables
      // (public.test_attempts/bookmarks/notes/notifications/
      // user_daily_activity/ai_usage) are confirmed live to be entirely
      // empty in this database (this legacy track predates the current
      // core.app_user-based one and was never actually written to by it) —
      // deleting public.users first, before they could ever be populated,
      // is safe today; if that ever changes, ON DELETE CASCADE (most of
      // them) or SET NULL (ai_usage) handles it automatically except
      // test_attempts (RESTRICT), which would need its own explicit delete
      // added here at that point.
      await run("public.users", `delete from public.users`);
    }

    await client.query("commit");
    return { counts, authUserIds };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
