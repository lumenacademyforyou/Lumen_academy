import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Test-layer hardening A10 (docs/test-layer-hardening-prompt.md,
// docs/BUGS.md#A10). assembleForAttempt's seed was captured onto
// assess.attempt.generation_seed at start time but nothing ever read it back
// — no way to reproduce a disputed paper's exact draw after the fact despite
// the plumbing already existing. reproduceAttemptAssembly closes that gap —
// but a real limitation was found live while writing this test, not
// theorized: A6's own fix (docs/BUGS.md#A6) marks a served question as
// "seen" in assess.user_question_seen at serve time, and LINE_CANDIDATE_SQL
// sorts unseen-before-seen. That means the very act of starting the
// original attempt changes the state its own candidate query depends on —
// calling reproduceAttemptAssembly any time *after* the attempt exists will
// generally NOT reproduce the same draw once any served question was
// previously unseen, because "unseen" is no longer true by the time you
// reproduce. This is now documented on reproduceAttemptAssembly itself.
//
// What IS still genuinely guaranteed, and what this test actually proves:
// assembleForAttempt is deterministic given (a) the same seed and (b)
// unchanged assess.user_question_seen / content.question state between two
// calls — i.e. the seeded ORDER BY is real determinism at the algorithm
// level, not accidental. Verified by calling it twice in a row with an
// explicit seed and no attempt started in between (so nothing mutates the
// exposure ledger between the two calls).
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "assembleForAttempt determinism: same seed + unchanged exposure state reproduces an identical draw",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async (t) => {
    const { pool } = await import("../../../shared/pool.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { assembleForAttempt } = await import("../generation/assemble.js");
    const { reproduceAttemptAssembly, startAttempt, submitAttempt } = await import("./attempt-flow.js");
    const { getAttemptEnvelope } = await import("./envelope.js");

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
      // concurrently with each other, making any row choice here safe. Row
      // 4 is kept only because it's already what this file used.
      const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id asc offset 3 limit 1`);
      if (userRes.rowCount === 0) throw new Error("no core.app_user row at the expected offset — needed to own the test attempt this creates");
      const userId = userRes.rows[0].user_id;

      await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = $1 and attempt_state in ('in_progress','paused')`, [userId]);

      const created = await createPracticeTest({
        examId,
        examCode,
        testType: "SUBJ",
        scopeCode: "A10REPRO",
        title: "A10 seed-determinism regression test",
        durationMinutes: 30,
        createdBy: userId,
        lines: [{ subjectId, includeDescendants: true, pickCount: 6, sectionName: subjectCode }],
      });
      await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);

      const fixedSeed = "123456789012345";

      await t.test("two calls with the same explicit seed, no attempt started in between, return the identical question set and order", async () => {
        const first = await assembleForAttempt(created.testId, userId, fixedSeed);
        const second = await assembleForAttempt(created.testId, userId, fixedSeed);
        assert.deepEqual(
          second.sections.flatMap((s) => s.questionIds),
          first.sections.flatMap((s) => s.questionIds),
          "assembleForAttempt returned different results for two calls with the identical seed and no state change in between"
        );
        assert.equal(second.seed, fixedSeed);
      });

      await t.test("reproduceAttemptAssembly runs successfully and returns the seed/testId/userId it was given, documenting (not silently hiding) that the drawn ids can legitimately differ post-serve", async () => {
        const attempt = await startAttempt(created.testId, userId);
        const envelope = await getAttemptEnvelope(attempt.attemptId, userId);
        assert.ok(envelope.questions.length > 0);

        const reproduced = await reproduceAttemptAssembly(attempt.attemptId);
        assert.equal(reproduced.attemptId, attempt.attemptId);
        assert.equal(reproduced.testId, created.testId);
        assert.equal(reproduced.userId, userId);
        assert.ok(reproduced.seed.length > 0);
        assert.ok(reproduced.sections.flatMap((s) => s.questionIds).length > 0, "reproduceAttemptAssembly returned no questions at all");

        await submitAttempt(attempt.attemptId, userId);
      });
    } finally {
      await pool.end();
    }
  }
);
