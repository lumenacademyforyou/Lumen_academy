import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";

// Image-based test type (docs/BUGS.md#E1-E3, user ask: "build a test for
// image based test in the whole application system"). Proves the actual
// mechanism assess.test_blueprint.has_image_only (029_blueprint_has_image_only.sql)
// -> assemble.ts's LINE_CANDIDATE_SQL/LINE_AVAILABLE_SQL filter -> a real
// served attempt only ever contains has_image=true questions, end to end
// through the real assembly pipeline (createPracticeTest -> startAttempt ->
// getAttemptEnvelope), not a unit test of the SQL string in isolation.
const hasDb = Boolean(process.env.DATABASE_URL);

test(
  "a blueprint line with hasImageOnly=true only ever serves has_image=true questions, and reports an honest available count when the pool is short",
  { skip: hasDb ? false : "DATABASE_URL not set — this integration test needs a live assess/catalog/content database" },
  async (t) => {
    const { pool } = await import("../../../shared/pool.js");
    const { PoolInsufficientError } = await import("../../../shared/errors.js");
    const { createPracticeTest } = await import("../definition/create-practice-test.js");
    const { startAttempt, submitAttempt } = await import("../attempt/attempt-flow.js");
    const { getAttemptEnvelope } = await import("../attempt/envelope.js");

    try {
      const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
      if (examRes.rowCount === 0) throw new Error("no active catalog.exam row — needed for this integration test");
      const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

      // The subject with the most real has_image=true published questions —
      // makes the "serve exactly the available count" sub-test meaningful
      // without hardcoding a subject name that could stop matching real
      // content.
      const subjectRes = await pool.query<{ subject_id: string; subject_code: string; n: string }>(
        `select sub.subject_id, sub.subject_code, count(distinct q.question_id) as n
           from content.question q
           join content.question_node_map qnm on qnm.question_id = q.question_id
           join catalog.syllabus_node sn on sn.node_id = qnm.node_id
           join catalog.subject sub on sub.subject_id = sn.subject_id
          where q.lifecycle_status = 'published' and q.has_image = true and sub.exam_id = $1
          group by sub.subject_id, sub.subject_code
          order by n desc
          limit 1`,
        [examId]
      );
      if (subjectRes.rowCount === 0) throw new Error("no subject with any published has_image=true question — needed for this test");
      const { subject_id: subjectId, subject_code: subjectCode, n } = subjectRes.rows[0];
      const availableImageQuestions = Number(n);

      const totalPublishedRes = await pool.query<{ n: string }>(
        `select count(distinct q.question_id) as n
           from content.question q
           join content.question_node_map qnm on qnm.question_id = q.question_id
           join catalog.syllabus_node sn on sn.node_id = qnm.node_id
          where q.lifecycle_status = 'published' and sn.subject_id = $1`,
        [subjectId]
      );
      const totalPublished = Number(totalPublishedRes.rows[0].n);
      assert.ok(totalPublished > availableImageQuestions, "test premise requires this subject to have more total published questions than image ones, to prove the filter actually excludes something");

      const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id asc offset 5 limit 1`);
      if (userRes.rowCount === 0) throw new Error("no core.app_user row at the expected offset — needed to own the test attempts this creates");
      const userId = userRes.rows[0].user_id;
      await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = $1 and attempt_state in ('in_progress', 'paused')`, [userId]);

      async function drawImageOnly(pickCount: number, scopeCode: string) {
        const created = await createPracticeTest({
          examId,
          examCode,
          testType: "SUBJ",
          scopeCode,
          title: `image-only blueprint test (${scopeCode})`,
          durationMinutes: 30,
          createdBy: userId,
          lines: [{ subjectId, includeDescendants: true, hasImageOnly: true, pickCount, sectionName: subjectCode }],
        });
        await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);
        const attempt = await startAttempt(created.testId, userId);
        const envelope = await getAttemptEnvelope(attempt.attemptId, userId);
        await submitAttempt(attempt.attemptId, userId);
        return envelope.questions.map((q) => q.questionId);
      }

      await t.test("serves exactly the requested count, all of them has_image=true, when the pool covers it", async () => {
        const requested = Math.min(3, availableImageQuestions);
        const ids = await drawImageOnly(requested, "IMGOK");
        assert.equal(ids.length, requested);

        const check = await pool.query<{ question_id: string; has_image: boolean }>(
          `select question_id, has_image from content.question where question_id = any($1::uuid[])`,
          [ids]
        );
        assert.equal(check.rowCount, requested);
        for (const row of check.rows) {
          assert.equal(row.has_image, true, `question ${row.question_id} was served by an hasImageOnly=true line but has_image=false`);
        }
      });

      await t.test("asking for more than the real has_image pool throws PoolInsufficientError with an honest available count (never silently widens to non-image questions)", async () => {
        const requested = totalPublished; // comfortably more than availableImageQuestions, well within the subject's real total pool
        await assert.rejects(
          () => drawImageOnly(requested, "IMGSHORT"),
          (err: unknown) => {
            assert.ok(err instanceof PoolInsufficientError, `expected PoolInsufficientError, got ${err instanceof Error ? err.constructor.name : typeof err}`);
            const poolErr = err as InstanceType<typeof PoolInsufficientError>;
            assert.equal(poolErr.requested, requested);
            // The honest count must reflect the image-only pool, not the
            // subject's much larger total published pool — proves
            // LINE_AVAILABLE_SQL applies the same has_image_only filter as
            // LINE_CANDIDATE_SQL, not just the happy-path query.
            assert.equal(poolErr.available, availableImageQuestions, "PoolInsufficientError.available did not reflect the has_image-filtered pool");
            return true;
          }
        );
      });
    } finally {
      await pool.end();
    }
  }
);
