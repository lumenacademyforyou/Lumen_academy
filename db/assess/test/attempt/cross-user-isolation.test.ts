import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// BUG-04 (docs/assessment-tool-debug-plan.md) — "Sessions left active after
// completing... it also reflects in other users accounts." The plan's own
// exit gate for this phase requires the cross-user row of the Session
// Matrix to be covered by an automated test, not a manual check (P2's
// Session Matrix, row 8: "User A takes test -> user B logs in -> B sees
// none of A's data anywhere"). Same live-DB-integration convention as
// assemble.test.ts: db/config/env.ts exits the process if DATABASE_URL is
// missing at import time, so every db/ import is deferred inside the test
// body and this is skipped (never silently passed) with no database.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "cross-user isolation: user A's attempt is invisible and inaccessible to user B",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async (t) => {
    const { pool } = await import("../../../shared/pool.js");
    const { NotFoundError } = await import("../../../shared/errors.js");
    const { startAttempt, submitAttempt, listAttempts, pauseAttempt } = await import("./attempt-flow.js");
    const { getAttemptEnvelope } = await import("./envelope.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");

    try {
      const usersRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id limit 2`);
      if (usersRes.rowCount !== 2) throw new Error("need at least 2 core.app_user rows for this test — none created/deleted here on purpose");
      const [userA, userB] = usersRes.rows.map((r) => r.user_id);

      // docs/no-repeat-questions-fix.md's collapse migration (031) means a
      // real per-unit distinct-content pool can now be as small as 1-2
      // questions (docs/POOL_CENSUS.md) — "any published assess.test row"
      // (whatever an earlier test file in this shared-DB run happened to
      // leave behind) is no longer a safe assumption; it only ever worked
      // by accident against the old duplicate-inflated pool sizes. This
      // test isn't about assembly/pool sizing at all, just cross-user
      // access control, so it builds its own small, deterministic
      // whole-subject-scoped test (same pattern as reproduce-assembly.test.ts's
      // A10REPRO fixture) instead of depending on shared-run state.
      const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
      if (examRes.rowCount === 0) throw new Error("no active catalog.exam row — needed for this integration test");
      const { exam_id: examId, exam_code: examCode } = examRes.rows[0];
      const subjectRes = await pool.query<{ subject_id: string; subject_code: string }>(
        `select subject_id, subject_code from catalog.subject where exam_id = $1 order by display_order limit 1`,
        [examId]
      );
      if (subjectRes.rowCount === 0) throw new Error("no catalog.subject row for the active exam");
      const { subject_id: subjectId, subject_code: subjectCode } = subjectRes.rows[0];

      const created = await createPracticeTest({
        examId,
        examCode,
        testType: "SUBJ",
        scopeCode: "CUISOFIX",
        title: "cross-user-isolation regression test",
        durationMinutes: 30,
        createdBy: userA,
        lines: [{ subjectId, includeDescendants: true, pickCount: 6, sectionName: subjectCode }],
      });
      await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);
      const testId = created.testId;

      // Neither account may have a pre-existing active attempt, or BUG-03's
      // own new guard would block this test's own startAttempt call — not a
      // workaround for the guard, just deterministic test setup against a
      // shared dev database's accumulated history (same reasoning as
      // assemble.test.ts's own setup step).
      await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = any($1::uuid[]) and attempt_state in ('in_progress','paused')`, [[userA, userB]]);

      const attemptA = await startAttempt(testId, userA);

      await t.test("user B's attempt list never contains user A's attempt", async () => {
        const bList = await listAttempts(userB);
        assert.ok(
          !bList.some((a) => a.attemptId === attemptA.attemptId),
          "user B's own GET /assess/attempts listing included user A's attempt id"
        );
      });

      await t.test("user B cannot fetch user A's attempt envelope", async () => {
        await assert.rejects(() => getAttemptEnvelope(attemptA.attemptId, userB), NotFoundError);
      });

      await t.test("user B cannot pause user A's attempt", async () => {
        await assert.rejects(() => pauseAttempt(attemptA.attemptId, userB), NotFoundError);
      });

      await t.test("user A's own access to their own attempt still works (the guard isn't just rejecting everyone)", async () => {
        const envelope = await getAttemptEnvelope(attemptA.attemptId, userA);
        assert.equal(envelope.questions.length > 0, true);
      });

      await submitAttempt(attemptA.attemptId, userA);

      await t.test("after user A submits, user B's dashboard-facing attempt list is still untouched", async () => {
        const bList = await listAttempts(userB);
        assert.ok(!bList.some((a) => a.attemptId === attemptA.attemptId), "user A's now-scored attempt leaked into user B's list");
      });
    } finally {
      await pool.end();
    }
  }
);
