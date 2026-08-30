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

    try {
      const usersRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id limit 2`);
      if (usersRes.rowCount !== 2) throw new Error("need at least 2 core.app_user rows for this test — none created/deleted here on purpose");
      const [userA, userB] = usersRes.rows.map((r) => r.user_id);

      const testRes = await pool.query<{ test_id: string }>(`select test_id from assess.test where test_status = 'published' limit 1`);
      if (testRes.rowCount === 0) throw new Error("no published assess.test row to attempt against");
      const testId = testRes.rows[0].test_id;

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
