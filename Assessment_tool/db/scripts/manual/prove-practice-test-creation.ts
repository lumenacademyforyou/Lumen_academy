import { pool } from "../../shared/pool.js";
import { createPracticeTest } from "../../assess/test/definition/create-practice-test.js";
import { assembleForAttempt } from "../../assess/test/generation/assemble.js";
import { startAttempt } from "../../assess/test/attempt/attempt-flow.js";
import { TEST_CODE_PATTERN } from "../../assess/test/definition/test-code.js";

// Proves the new chapter/topic/unit/subject-wise practice-test path end to
// end against real live data: creates a real chapter-wise test scoped to
// phy_02 (Electrostatics & Current Electricity, 35 published questions
// live), publishes it, assembles a real attempt against it, and confirms
// every served question actually belongs to phy_02.

async function main() {
  const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam limit 1`);
  const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

  const nodeRes = await pool.query<{ node_id: string; subject_id: string; tag_code: string }>(
    `select node_id, subject_id, tag_code from catalog.syllabus_node where tag_code = 'phy_02'`
  );
  if (nodeRes.rowCount === 0) throw new Error("phy_02 not found");
  const { node_id: nodeId, subject_id: subjectId, tag_code: tagCode } = nodeRes.rows[0];

  const adminRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = 'lumenacademyforyou@gmail.com'`);
  const createdBy = adminRes.rows[0].user_id;

  const test = await createPracticeTest({
    examId,
    examCode,
    testType: "CHAP",
    scopeCode: tagCode,
    title: "Chapter Practice — Electrostatics & Current Electricity",
    durationMinutes: 20,
    createdBy,
    lines: [
      {
        subjectId,
        syllabusNodeId: nodeId,
        includeDescendants: false,
        pickCount: 15,
        sectionName: "Electrostatics & Current Electricity",
      },
    ],
  });

  console.log(`created test: ${test.testCode} (${test.testId})`);
  if (!TEST_CODE_PATTERN.test(test.testCode)) throw new Error(`test_code "${test.testCode}" does not match the documented format`);
  console.log("Part 1 PASS — test_code follows the LMN-<EXAM>-<TYPE>-<SCOPE>-<serial> convention.");

  await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [test.testId]);

  const studentRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = 'student@lumen.internal'`);
  const studentId = studentRes.rows[0].user_id;

  const assembled = await assembleForAttempt(test.testId, studentId);
  console.log(`Part 2 — assembleForAttempt returned ${assembled.sections[0].questionIds.length} question(s)`);
  if (assembled.sections[0].questionIds.length !== 15) throw new Error("expected exactly 15 assembled questions");

  const ownershipCheck = await pool.query<{ n: string }>(
    `select count(*) as n
       from content.question q
       join content.question_node_map qnm on qnm.question_id = q.question_id
      where q.question_id = any($1::uuid[]) and qnm.node_id = $2`,
    [assembled.sections[0].questionIds, nodeId]
  );
  if (Number(ownershipCheck.rows[0].n) !== 15) throw new Error("not every assembled question actually belongs to phy_02");
  console.log("Part 2 PASS — all 15 assembled questions genuinely belong to phy_02, none from any other chapter.");

  const attempt = await startAttempt(test.testId, studentId);
  console.log(`Part 3 — startAttempt succeeded: ${attempt.attemptId}, state=${attempt.attemptState}`);
  const servedRes = await pool.query<{ n: string }>(`select count(*) as n from assess.attempt_question where attempt_id = $1`, [attempt.attemptId]);
  if (Number(servedRes.rows[0].n) !== 15) throw new Error("attempt_question does not have 15 rows for this attempt");
  console.log("Part 3 PASS — a real student can actually start and be served this chapter-wise test.");

  console.log(`\nPRACTICE-TEST CREATION PASS — chapter-wise ("${tagCode}") tests work end to end: create -> publish -> assemble -> start attempt.`);
  await pool.end();
}

main().catch((err) => {
  console.error("proof failed:", err);
  process.exitCode = 1;
});
