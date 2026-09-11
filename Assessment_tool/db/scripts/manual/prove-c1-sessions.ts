import { pool } from "../../shared/pool.js";
import { createPracticeTest, type PracticeTestLine } from "../../assess/test/definition/create-practice-test.js";
import { startAttempt } from "../../assess/test/attempt/attempt-flow.js";
import { getAttemptEnvelope } from "../../assess/test/attempt/envelope.js";
import { PoolInsufficientError } from "../../shared/errors.js";

// Manual proof for Phase C's C1 (POST /api/assess/sessions) — exercises the
// same createPracticeTest -> startAttempt -> getAttemptEnvelope chain
// backend/src/controllers/sessionController.ts drives, for each mode,
// against the live database. Prints composition and asserts zero duplicate
// questions within a paper (C9's "console assembly harness" requirement).
//
// Usage: npx tsx db/scripts/manual/prove-c1-sessions.ts

const STUDENT_EMAIL = "student@lumen.internal";

async function resolveExam() {
  const res = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
  return res.rows[0];
}

async function resolveSubjects() {
  const res = await pool.query<{ subject_id: string; subject_code: string }>(`select subject_id, subject_code from catalog.subject order by display_order`);
  return res.rows;
}

async function resolveStudentId(): Promise<string> {
  const res = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = $1`, [STUDENT_EMAIL]);
  if (res.rowCount === 0) throw new Error(`${STUDENT_EMAIL} not found`);
  return res.rows[0].user_id;
}

function assertNoDuplicates(label: string, questionIds: string[]) {
  const unique = new Set(questionIds);
  if (unique.size !== questionIds.length) {
    throw new Error(`${label}: duplicate question found! ${questionIds.length} served, ${unique.size} unique`);
  }
  console.log(`  [ok] ${label}: ${questionIds.length} questions served, 0 duplicates`);
}

async function runLines(label: string, examId: string, examCode: string, testType: "SUBJ" | "MOCK", scopeCode: string, lines: PracticeTestLine[], studentId: string) {
  console.log(`\n=== ${label} ===`);
  try {
    const test = await createPracticeTest({
      examId,
      examCode,
      testType,
      scopeCode,
      title: label,
      durationMinutes: 60,
      createdBy: studentId,
      lines,
    });
    await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [test.testId]);

    const attempt = await startAttempt(test.testId, studentId);
    const envelope = await getAttemptEnvelope(attempt.attemptId, studentId);

    const byUnit = new Map<string, number>();
    for (const s of envelope.sections) byUnit.set(s.sectionName, s.questionCount);
    console.log(`  composition (per section):`, Object.fromEntries(byUnit));
    console.log(`  answer-key leak check: has isCorrect field? ${JSON.stringify(envelope.questions[0]).includes("isCorrect")}`);

    assertNoDuplicates(label, envelope.questions.map((q) => q.questionId));
  } catch (err) {
    if (err instanceof PoolInsufficientError) {
      console.log(`  [expected-possible] PoolInsufficientError: blueprint ${err.blueprintId} wanted ${err.requested}, only ${err.available} available`);
    } else {
      throw err;
    }
  }
}

async function main() {
  const exam = await resolveExam();
  const subjects = await resolveSubjects();
  const studentId = await resolveStudentId();
  const bySubject = new Map(subjects.map((s) => [s.subject_code, s.subject_id]));

  // subject-wise: a well-stocked subject (BOT is fully published per Phase B).
  await runLines(
    "subject-wise (Botany, 10 questions)",
    exam.exam_id,
    exam.exam_code,
    "SUBJ",
    "BOT",
    [{ subjectId: bySubject.get("BOT")!, includeDescendants: true, pickCount: 10, sectionName: "BOT" }],
    studentId
  );

  // custom: multi-line across two well-stocked subjects with different counts.
  await runLines(
    "custom (Botany 8 + Chemistry 6)",
    exam.exam_id,
    exam.exam_code,
    "MOCK",
    "CUSTOM",
    [
      { subjectId: bySubject.get("BOT")!, includeDescendants: true, pickCount: 8, sectionName: "BOT" },
      { subjectId: bySubject.get("CHEM")!, includeDescendants: true, pickCount: 6, sectionName: "CHEM" },
    ],
    studentId
  );

  // full-mock: real NEET shape, 45/subject. Phase B's bulk-publish may still
  // be in flight for Physics/Zoology at the time this runs — a
  // PoolInsufficientError here is expected-and-correct (C8), not a bug; it's
  // designed to pass cleanly once all four subjects are fully published.
  await runLines(
    "full-mock (45/subject, all 4 subjects)",
    exam.exam_id,
    exam.exam_code,
    "MOCK",
    "ALL",
    subjects.map((s) => ({ subjectId: s.subject_id, includeDescendants: true, pickCount: 45, sectionName: s.subject_code })),
    studentId
  );

  await pool.end();
}

main().catch((err) => {
  console.error("prove-c1-sessions failed:", err);
  process.exitCode = 1;
});
