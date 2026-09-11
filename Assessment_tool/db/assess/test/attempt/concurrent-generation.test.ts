import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Test-layer hardening A4/A4b (docs/test-layer-hardening-prompt.md,
// docs/BUGS.md). Proves two things that were real, live bugs before this
// session's fix — this is the "failing test that proves it was broken"
// the prompt's fix-phase non-negotiables require:
//
// A4 — assembleForAttempt() used to call the shared `pool` directly while
// startAttempt() already held one of the pool's 4 connections open inside
// its own transaction (db/shared/pool.ts caps `max: 4`). Four or more
// concurrent BLUEPRINT-mode startAttempt calls would each need a 5th
// connection from the same exhausted pool, deadlocking every one of them
// forever — the exact bug pattern already found and fixed once in this file
// for loadSectionSchemes, left unfixed for assembleForAttempt until now.
// Fixed by threading startAttempt's own transaction client through to
// assembleForAttempt instead of letting it fall back to the pool.
//
// A4b — the "one active attempt per user" check ran as a plain query before
// the transaction/connection was even acquired: a TOCTOU race where two
// near-simultaneous startAttempt calls for the same user (two tabs, a
// retried request) could both read zero active attempts before either had
// committed, producing two concurrent in_progress attempts. Fixed with a
// pg_advisory_xact_lock keyed on user_id, taken at the top of the
// transaction before the active-attempt check — a second concurrent caller
// now blocks until the first commits/rolls back, then sees real state.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "concurrent generation: no pool-exhaustion deadlock across users, no double-active-attempt race for one user",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database", timeout: 60_000 },
  async (t) => {
    const { pool } = await import("../../../shared/pool.js");
    const { ActiveAttemptExistsError } = await import("../../../shared/errors.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { startAttempt, submitAttempt } = await import("./attempt-flow.js");

    try {
      const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
      if (examRes.rowCount === 0) throw new Error("no active catalog.exam row — needed for this integration test");
      const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

      const subjectRes = await pool.query<{ subject_id: string; subject_code: string }>(
        `select subject_id, subject_code from catalog.subject where exam_id = $1 order by display_order limit 1`,
        [examId]
      );
      if (subjectRes.rowCount === 0) throw new Error("no catalog.subject row for the active exam");
      const { subject_id: subjectId, subject_code: subjectCode } = subjectRes.rows[0];

      // db/shared/pool.ts caps the pool at 4 — need at least 4 distinct
      // users to genuinely exhaust it concurrently. This shared dev
      // database's core.app_user table is also used by other
      // attempt-lifecycle integration tests in this directory —
      // package.json's test:unit script runs `node --test
      // --test-concurrency=1` specifically so these files never execute
      // concurrently with each other, so the exact rows picked here don't
      // matter. The second sub-test's same-user race reuses userIds[0]
      // *after* the first sub-test has already submitted its attempt for
      // that user, rather than needing a 5th user.
      const usersRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id asc offset 5 limit 4`);
      if ((usersRes.rowCount ?? 0) < 4) throw new Error("need at least 9 core.app_user rows total for this test");
      const userIds = usersRes.rows.map((r) => r.user_id);

      // Same reasoning as assemble.test.ts / cross-user-isolation.test.ts:
      // force-close any pre-existing active attempts on a shared dev
      // database's accumulated history so this test's own startAttempt
      // calls aren't blocked by unrelated leftover state.
      await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = any($1::uuid[]) and attempt_state in ('in_progress','paused')`, [userIds]);

      const created = await createPracticeTest({
        examId,
        examCode,
        testType: "SUBJ",
        scopeCode: "A4CONC",
        title: "A4/A4b concurrent-generation regression test",
        durationMinutes: 30,
        createdBy: userIds[0],
        lines: [{ subjectId, includeDescendants: true, pickCount: 5, sectionName: subjectCode }],
      });
      await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);

      await t.test("4 concurrent BLUEPRINT-mode generations (== pool.max), different users, all complete without deadlocking", async () => {
        const concurrentUsers = userIds.slice(0, 4);
        const startedAt = Date.now();
        const results = await Promise.all(concurrentUsers.map((uid) => startAttempt(created.testId, uid)));
        const elapsedMs = Date.now() - startedAt;

        assert.equal(results.length, 4);
        for (const r of results) assert.ok(r.attemptId, "a concurrent startAttempt call returned no attemptId");
        // Generous but bounded — before the A4 fix this combination hung
        // forever (every connection waiting on a 5th that could never free
        // up), so any finite bound here is a meaningful regression check,
        // not a tight performance assertion.
        assert.ok(elapsedMs < 30_000, `4 concurrent generations took ${elapsedMs}ms — looks like the pool-exhaustion deadlock (A4) reappeared`);

        await Promise.all(concurrentUsers.map((uid, i) => submitAttempt(results[i].attemptId, uid)));
      });

      await t.test("two concurrent startAttempt calls for the SAME user: exactly one succeeds, never two active attempts", async () => {
        // Reuses userIds[0] — safe because the previous sub-test already
        // submitted (closed) that user's attempt before this one runs; see
        // the comment on the users query above for why this avoids needing
        // a 5th reserved row.
        const raceUser = userIds[0];
        const settled = await Promise.allSettled([startAttempt(created.testId, raceUser), startAttempt(created.testId, raceUser)]);
        const fulfilled = settled.filter((s): s is PromiseFulfilledResult<Awaited<ReturnType<typeof startAttempt>>> => s.status === "fulfilled");
        const rejected = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");

        assert.equal(fulfilled.length, 1, `expected exactly 1 of 2 concurrent same-user startAttempt calls to succeed, got ${fulfilled.length} (A4b regression if this drifts from 1)`);
        assert.equal(rejected.length, 1);
        assert.ok(
          rejected[0].reason instanceof ActiveAttemptExistsError,
          `expected the losing concurrent call to reject with ActiveAttemptExistsError, got ${rejected[0].reason}`
        );

        const activeRes = await pool.query<{ n: string }>(
          `select count(*) as n from assess.attempt where user_id = $1 and attempt_state in ('in_progress','paused')`,
          [raceUser]
        );
        assert.equal(Number(activeRes.rows[0].n), 1, "more than one active attempt exists for the same user after a concurrent race — A4b TOCTOU regression");

        await submitAttempt(fulfilled[0].value.attemptId, raceUser);
      });
    } finally {
      await pool.end();
    }
  }
);
