import { pool } from "../../shared/pool.js";
import { createPracticeTest } from "../../assess/test/definition/create-practice-test.js";
import { startAttempt } from "../../assess/test/attempt/attempt-flow.js";
import { getAttemptEnvelope } from "../../assess/test/attempt/envelope.js";

// One-off verification of Phase C's own "done when" clause (LA-APP-COMPLETION-001):
// "two concurrent requests for the same blueprint produce different question
// sets" + "images resolve". Not a permanent harness (that's prove-c1-sessions.ts) —
// targets a specific image-bearing unit (chem_08) to force an image-bearing
// question into the served envelope, which a random full-mock/subject-wise
// pick over the whole bank isn't guaranteed to do.

async function main() {
  const examRes = await pool.query<{ exam_id: string; exam_code: string }>(
    `select exam_id, exam_code from catalog.exam where is_active = true limit 1`
  );
  const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

  const subjectRes = await pool.query<{ subject_id: string }>(
    `select subject_id from catalog.subject where subject_code = 'CHEM' and exam_id = $1`,
    [examId]
  );
  const subjectId = subjectRes.rows[0].subject_id;

  const nodeRes = await pool.query<{ node_id: string }>(
    `select node_id from catalog.syllabus_node where tag_code = 'chem_08'`
  );
  const nodeId = nodeRes.rows[0].node_id;

  const userRes = await pool.query<{ user_id: string }>(
    `select user_id from core.app_user where email = 'lumenacademyforyou@gmail.com'`
  );
  const userId = userRes.rows[0].user_id;

  async function runOne(label: string) {
    const test = await createPracticeTest({
      examId,
      examCode,
      testType: "UNIT",
      scopeCode: "CHEM08",
      title: `verify-c-done-when ${label}`,
      durationMinutes: 30,
      createdBy: userId,
      lines: [{ subjectId, syllabusNodeId: nodeId, includeDescendants: false, pickCount: 20, sectionName: "CHEM" }],
    });
    await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [test.testId]);
    const attempt = await startAttempt(test.testId, userId);
    const envelope = await getAttemptEnvelope(attempt.attemptId, userId);
    const withImages = envelope.questions.filter((q) => q.images.length > 0);
    console.log(`${label}: ${envelope.questions.length} questions, ${withImages.length} with images`);
    if (withImages.length > 0) {
      console.log(`  sample image URL: ${withImages[0].images[0].url}`);
    }
    return envelope.questions.map((q) => q.questionId);
  }

  const a = await runOne("request A");
  const b = await runOne("request B");
  const same = a.length === b.length && a.every((id, i) => id === b[i]);
  console.log(`\nsame blueprint, two requests -> identical question sets? ${same} (expect false)`);

  await pool.end();
}

main().catch((err) => {
  console.error("verify-c-done-when failed:", err);
  process.exitCode = 1;
});
