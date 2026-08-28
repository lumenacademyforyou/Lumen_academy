import { pool } from "../../../shared/pool.js";

/**
 * test_code naming convention — mirrors content.question's question_uid
 * convention exactly (schemas/question-authoring.schema.ts):
 *
 *   LMN-<EXAM_CODE>-<TEST_TYPE>-<SCOPE_CODE>-<6-digit serial>
 *
 * EXAM_CODE  = catalog.exam.exam_code, upper-case (e.g. "NEET").
 * TEST_TYPE  = MOCK | SUBJ | CHAP | TOPIC | UNIT — which category of test
 *              this is, so a test_code alone tells you what kind of test it
 *              is without a join, same as question_uid's subject/node
 *              segments do for a question.
 * SCOPE_CODE = what the test is scoped to: a subject_code for SUBJ, a
 *              syllabus_node.tag_code (upper-cased, underscores stripped —
 *              identical transform to question_uid's NODE_CODE) for
 *              CHAP/TOPIC/UNIT, or "ALL" for MOCK (spans every subject).
 * serial     = 000001-upward, unique per (EXAM_CODE, TEST_TYPE, SCOPE_CODE)
 *              triple — this module assigns the next free serial; callers
 *              never need to know the current max.
 */
export type TestTypeCode = "MOCK" | "SUBJ" | "CHAP" | "TOPIC" | "UNIT";

export const TEST_CODE_PATTERN = /^LMN-[A-Z]+-(MOCK|SUBJ|CHAP|TOPIC|UNIT)-[A-Z0-9]+-\d{6}$/;

function normaliseScopeCode(scopeCode: string): string {
  return scopeCode.toUpperCase().replace(/_/g, "");
}

/**
 * Reverses sessionController.ts's testType/scopeCode choice (LA-APP-COMPLETION-001
 * Phase C1) back into the mode label the frontend's SessionResult type uses.
 * Read directly off the test_code string so a resumed/reloaded attempt
 * (envelope.ts) doesn't need a second query to know how to render itself —
 * SUBJ/UNIT -> subject-wise, MOCK+ALL -> full-mock, MOCK+CUSTOM -> custom.
 */
export function deriveSessionModeFromTestCode(testCode: string): "subject-wise" | "full-mock" | "custom" {
  const match = testCode.match(/^LMN-[A-Z]+-(MOCK|SUBJ|CHAP|TOPIC|UNIT)-([A-Z0-9]+)-\d{6}$/);
  if (!match) return "custom";
  const [, testType, scopeCode] = match;
  if (testType === "SUBJ" || testType === "UNIT") return "subject-wise";
  if (testType === "MOCK" && scopeCode === "ALL") return "full-mock";
  return "custom";
}

/**
 * Assigns the next free serial for (examCode, testType, scopeCode) and
 * returns the full test_code. Reads the current max under the caller's own
 * transaction client when given (pass the same `client` createTest/
 * createPracticeTest use) so two concurrent creations of the same shape
 * can't race onto the same serial — same pattern as
 * schemas/question-authoring.schema.ts's questionUid convention comment
 * describes for CL-2, just enforced here rather than left to authors.
 */
export async function generateTestCode(
  examCode: string,
  testType: TestTypeCode,
  scopeCode: string,
  client: { query: typeof pool.query } = pool
): Promise<string> {
  const prefix = `LMN-${examCode.toUpperCase()}-${testType}-${normaliseScopeCode(scopeCode)}-`;
  const res = await client.query<{ test_code: string }>(
    `select test_code from assess.test where test_code like $1 order by test_code desc limit 1`,
    [`${prefix}%`]
  );
  const nextSerial = res.rowCount && res.rowCount > 0 ? Number(res.rows[0].test_code.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(nextSerial).padStart(6, "0")}`;
}
