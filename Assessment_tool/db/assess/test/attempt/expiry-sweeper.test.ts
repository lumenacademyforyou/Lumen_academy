import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Test-layer hardening C3 (docs/test-layer-hardening-prompt.md,
// docs/BUGS.md#C3). Proves the actual Definition-of-Done wording: "Timer
// expiry with no client connected -> server auto-submits within the
// sweeper interval." Before this fix, nothing ever called the expired-
// attempt query automatically — this test simulates exactly that scenario
// (an attempt whose deadline has passed, with no further client request
// ever made against it) and calls sweepExpiredAttempts() directly, the same
// function backend/src/jobs/expirySweeper.ts now runs on a timer inside the
// live server process.
//
// Also covers C1 (docs/BUGS.md#C1): an attempt that's never answered at all
// before it expires is exactly this file's own main scenario (startAttempt,
// then nothing) — the sweeper used to force-score it as "0/N, scored" like a
// genuine empty submission; it now correctly reports "abandoned" instead
// (see attempt-flow.ts's abandonAttempt), with a second sub-test proving an
// attempt with at least one real response still goes through the unchanged
// `scored` path.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "sweepExpiredAttempts: force-closes an attempt whose deadline has passed with no client ever reconnecting",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async (t) => {
    const { pool } = await import("../../../shared/pool.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { startAttempt } = await import("./attempt-flow.js");
    const { sweepExpiredAttempts } = await import("./expiry.js");

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

      // This shared dev database's core.app_user table is also used by
      // several other attempt-lifecycle integration tests in this
      // directory — package.json's test:unit script runs `node --test
      // --test-concurrency=1` specifically so these files never execute
      // concurrently with each other, making any row choice here safe.
      const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id limit 1`);
      if (userRes.rowCount === 0) throw new Error("no core.app_user row — needed to own the test attempt this creates");
      const userId = userRes.rows[0].user_id;
      await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = $1 and attempt_state in ('in_progress','paused')`, [userId]);

      const created = await createPracticeTest({
        examId,
        examCode,
        testType: "SUBJ",
        scopeCode: "C3SWEEP",
        title: "C3 expiry-sweeper regression test",
        durationMinutes: 30,
        createdBy: userId,
        lines: [{ subjectId, includeDescendants: true, pickCount: 3, sectionName: subjectCode }],
      });
      await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);

      const attempt = await startAttempt(created.testId, userId);

      await t.test("an attempt whose deadline is still in the future is left untouched by the sweeper", async () => {
        const before = await sweepExpiredAttempts();
        const stateRes = await pool.query<{ attempt_state: string }>(`select attempt_state from assess.attempt where attempt_id = $1`, [attempt.attemptId]);
        assert.equal(stateRes.rows[0].attempt_state, "in_progress", "sweeper touched an attempt that hadn't expired yet");
        // Not asserting `before.found === 0` — other stale rows may exist in
        // this shared dev DB from unrelated history; only this attempt's own
        // state is this sub-test's concern.
        void before;
      });

      await t.test("simulating deadline passing with no client ever reconnecting, never answered: the sweeper abandons it, not force-scores it (C1)", async () => {
        // Simulates "no client ever reconnects" literally — nothing in this
        // test calls getEnvelope/listOwnAttempts/startAttempt again for this
        // attempt, which are the only lazy-reconciliation trigger points
        // (expiry.ts's enforceExpiry/reconcileUserAttempts). Only
        // sweepExpiredAttempts (the sweeper) touches it from here on. This
        // attempt was never answered (no upsertResponse call anywhere above),
        // so C1's zero-response rule applies: `abandoned`, not a misleading
        // "0/N, scored".
        await pool.query(`update assess.attempt set server_deadline = now() - interval '1 hour' where attempt_id = $1`, [attempt.attemptId]);

        const result = await sweepExpiredAttempts();
        assert.ok(result.found >= 1, "sweepExpiredAttempts found zero expired attempts even though this test just created one with a past deadline");
        assert.ok(result.abandoned >= 1, "sweepExpiredAttempts did not report any abandoned attempts for a never-answered expired attempt");

        const stateRes = await pool.query<{ attempt_state: string; submitted_reason: string | null }>(
          `select attempt_state, submitted_reason from assess.attempt where attempt_id = $1`,
          [attempt.attemptId]
        );
        assert.equal(stateRes.rows[0].attempt_state, "abandoned", "the sweeper did not correctly abandon the never-answered expired attempt");
        assert.equal(stateRes.rows[0].submitted_reason, "sweeper");
      });

      await t.test("running the sweeper again is a no-op for the now-abandoned attempt (idempotent)", async () => {
        const result = await sweepExpiredAttempts();
        const stateRes = await pool.query<{ attempt_state: string }>(`select attempt_state from assess.attempt where attempt_id = $1`, [attempt.attemptId]);
        assert.equal(stateRes.rows[0].attempt_state, "abandoned");
        void result;
      });

      await t.test("an expired attempt with at least one saved response is still force-scored, not abandoned (C1)", async () => {
        const { upsertResponse } = await import("./attempt-flow.js");

        const secondAttempt = await startAttempt(created.testId, userId);
        const servedRes = await pool.query<{ question_id: string }>(
          `select question_id from assess.attempt_question where attempt_id = $1 order by sequence_no limit 1`,
          [secondAttempt.attemptId]
        );
        assert.ok(servedRes.rowCount && servedRes.rowCount > 0, "no question was served for the second attempt");
        const optionRes = await pool.query<{ option_id: string }>(
          `select option_id from content.question_option where question_id = $1 limit 1`,
          [servedRes.rows[0].question_id]
        );
        assert.ok(optionRes.rowCount && optionRes.rowCount > 0, "the served question has no options to answer with");

        // A real answer, exactly what distinguishes this from the
        // never-touched case above.
        await upsertResponse(secondAttempt.attemptId, servedRes.rows[0].question_id, userId, { optionId: optionRes.rows[0].option_id });
        await pool.query(`update assess.attempt set server_deadline = now() - interval '1 hour' where attempt_id = $1`, [secondAttempt.attemptId]);

        const result = await sweepExpiredAttempts();
        assert.ok(result.closed >= 1, "sweepExpiredAttempts did not report the answered expired attempt as scored/closed");

        const stateRes = await pool.query<{ attempt_state: string; submitted_reason: string | null }>(
          `select attempt_state, submitted_reason from assess.attempt where attempt_id = $1`,
          [secondAttempt.attemptId]
        );
        assert.equal(stateRes.rows[0].attempt_state, "scored", "an attempt with a real saved response was incorrectly abandoned instead of scored");
        assert.equal(stateRes.rows[0].submitted_reason, "sweeper");
      });

      await t.test("a paused attempt is never force-closed by the sweeper, no matter how far past its nominal deadline (live regression: 'can't resume the paused test')", async () => {
        // Found live while investigating that report: paused_ms_total is
        // only credited retroactively, inside resumeAttempt's own
        // transaction, once a pause actually *ends* — it does not grow
        // while a pause is still open. A stale server_deadline + old
        // paused_ms_total formula therefore made a long-paused attempt look
        // "expired" even though pausing is this app's own sanctioned
        // stop-the-clock mechanism. Simulates the worst case directly: a
        // deadline set far in the past AND still paused — must survive the
        // sweeper regardless.
        const { pauseAttempt } = await import("./attempt-flow.js");

        const thirdAttempt = await startAttempt(created.testId, userId);
        await pauseAttempt(thirdAttempt.attemptId, userId);
        await pool.query(`update assess.attempt set server_deadline = now() - interval '10 hours' where attempt_id = $1`, [thirdAttempt.attemptId]);

        const result = await sweepExpiredAttempts();
        void result;

        const stateRes = await pool.query<{ attempt_state: string }>(`select attempt_state from assess.attempt where attempt_id = $1`, [thirdAttempt.attemptId]);
        assert.equal(stateRes.rows[0].attempt_state, "paused", "the sweeper force-closed a paused attempt — pausing must suspend expiry enforcement entirely until resumed");

        // Cleanup, not part of the assertion above: this user can only have
        // one active (in_progress/paused) attempt at a time (A4b's guard),
        // and the next sub-test needs to start a fresh one. Proven correct
        // is not the same as "leave it lying around" — closing it here is
        // ordinary test hygiene, same as every other file in this directory
        // does between sub-tests sharing one account.
        await pool.query(`update assess.attempt set attempt_state = 'abandoned' where attempt_id = $1`, [thirdAttempt.attemptId]);
      });

      await t.test("enforceExpiry (the lazy, per-request path) also never force-closes a paused attempt", async () => {
        // Same fix, the other code path — enforceExpiry backs the on-read
        // reconciliation getEnvelope/listOwnAttempts/getActiveSession all
        // funnel through, a completely separate query from
        // sweepExpiredAttempts's. Both had to be fixed; both need their own
        // proof.
        const { enforceExpiry } = await import("./expiry.js");
        const { pauseAttempt } = await import("./attempt-flow.js");

        const fourthAttempt = await startAttempt(created.testId, userId);
        await pauseAttempt(fourthAttempt.attemptId, userId);
        await pool.query(`update assess.attempt set server_deadline = now() - interval '10 hours' where attempt_id = $1`, [fourthAttempt.attemptId]);

        const result = await enforceExpiry(fourthAttempt.attemptId, userId);
        assert.equal(result, null, "enforceExpiry force-closed a paused attempt instead of leaving it alone");

        const stateRes = await pool.query<{ attempt_state: string }>(`select attempt_state from assess.attempt where attempt_id = $1`, [fourthAttempt.attemptId]);
        assert.equal(stateRes.rows[0].attempt_state, "paused");
      });
    } finally {
      await pool.end();
    }
  }
);
