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

export async function wipeUserOwnedData(pool: Pool, opts: { userId?: string } = {}): Promise<WipeResult> {
  const { userId } = opts;
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
    if (!userId) {
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
    if (!userId) {
      await run("core.student_profile", `delete from core.student_profile`);
      await run("core.educator_profile", `delete from core.educator_profile`);
      await run("core.app_user", `delete from core.app_user`);
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
