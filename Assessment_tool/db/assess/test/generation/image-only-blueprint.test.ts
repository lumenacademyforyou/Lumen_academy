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

    // Asset rows this test creates to guarantee an image-bearing pool exists.
    // content.has_image is trigger-maintained from content.asset
    // (028_has_image_computed.sql), so inserting these sets has_image=true and
    // deleting them in the finally block puts it back — the fixture leaves no
    // trace either way.
    const fixtureAssetIds: string[] = [];

    try {
      const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
      if (examRes.rowCount === 0) throw new Error("no active catalog.exam row — needed for this integration test");
      const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

      // This test used to depend on the live bank happening to contain
      // image-bearing questions. That is a content fact, not a code fact, and
      // the 2026-09-02 bank replacement (1140 questions, none with images)
      // removed it — the test then failed for a reason that said nothing about
      // the mechanism under test. It now builds its own image pool when the
      // bank has none, so it proves the has_image_only filter either way.
      const existing = await pool.query<{ n: string }>(
        `select count(*)::text as n from content.question where lifecycle_status = 'published' and has_image = true`
      );
      if (Number(existing.rows[0].n) < 3) {
        const seed = await pool.query<{ question_id: string }>(
          `select q.question_id
             from content.question q
             join content.question_node_map qnm on qnm.question_id = q.question_id
             join catalog.syllabus_node sn on sn.node_id = qnm.node_id
             join catalog.subject sub on sub.subject_id = sn.subject_id
            where q.lifecycle_status = 'published' and q.has_image = false and sub.exam_id = $1
            order by q.question_uid
            limit 3`,
          [examId]
        );
        for (const row of seed.rows) {
          const ins = await pool.query<{ asset_id: string }>(
            `insert into content.asset (question_id, asset_type, target_role, storage_uri, alt_text)
             values ($1, 'image', 'stem', $2, 'image-only blueprint test fixture')
             returning asset_id`,
            [row.question_id, "test-fixture://image-only-blueprint/" + row.question_id + ".png"]
          );
          fixtureAssetIds.push(ins.rows[0].asset_id);
        }
      }

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
      // Remove the fixture first, while the pool is still open. The
      // content.asset delete trigger recomputes has_image, so every seeded
      // question goes back to has_image=false.
      if (fixtureAssetIds.length > 0) {
        await pool.query(`delete from content.asset where asset_id = any($1::uuid[])`, [fixtureAssetIds]);
      }
      await pool.end();
    }
  }
);
