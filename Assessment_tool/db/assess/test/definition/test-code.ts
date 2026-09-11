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

/**
 * Test-layer hardening F4 (docs/BUGS.md#F4): adding a test type used to mean
 * independently-maintained edits in at least three files — this union
 * (test-code.ts), sessionController.ts's `toLines()` if-chain plus
 * `hasCompletedPracticeTest`'s hand-written MOCK-exclusion regex, and
 * assess.routes.ts's `z.enum([...])` allowlist — with nothing forcing them
 * to agree. This table is the single source for the two properties that
 * were actually independently duplicated (confirmed by tracing every
 * TestTypeCode consumer, not assumed): whether a type is single-scope (one
 * subject/node — SUBJ/CHAP/TOPIC/UNIT, the shape `POST /tests/practice`
 * accepts) versus multi-scope (assembled from several blueprint lines
 * spanning subjects — MOCK, which that route deliberately excludes), and
 * whether an attempt of that type counts toward "has completed a practice
 * test" (BUG-28's full-mock gate — every type except MOCK). Deliberately
 * not adding a default-duration or marking-scheme-key field here: neither is
 * actually duplicated across multiple call sites today (full-mock's duration
 * is one constant in sessionController.ts; the marking-scheme lookup key is
 * a separate, unrelated hardcode — D6's "related, smaller gap," out of this
 * bug's scope) — adding config surface nothing yet needs would be
 * speculative, not closing a real duplication.
 */
export interface TestTypeConfig {
  isSingleScope: boolean;
  countsAsPractice: boolean;
}

export const TEST_TYPE_CONFIG: Record<TestTypeCode, TestTypeConfig> = {
  SUBJ: { isSingleScope: true, countsAsPractice: true },
  CHAP: { isSingleScope: true, countsAsPractice: true },
  TOPIC: { isSingleScope: true, countsAsPractice: true },
  UNIT: { isSingleScope: true, countsAsPractice: true },
  MOCK: { isSingleScope: false, countsAsPractice: false },
};

const ALL_TEST_TYPES = Object.keys(TEST_TYPE_CONFIG) as TestTypeCode[];

/** The `POST /tests/practice` route's allowed testType values — every single-scope type, read from TEST_TYPE_CONFIG instead of a hand-maintained literal list. */
export const SINGLE_SCOPE_TEST_TYPES = ALL_TEST_TYPES.filter((t) => TEST_TYPE_CONFIG[t].isSingleScope);

/** The test types excluded from `hasCompletedPracticeTest`'s "has this user completed a real practice test" check — currently just MOCK, read from TEST_TYPE_CONFIG instead of a hand-written regex literal. */
export const NON_PRACTICE_TEST_TYPES = ALL_TEST_TYPES.filter((t) => !TEST_TYPE_CONFIG[t].countsAsPractice);

function normaliseScopeCode(scopeCode: string): string {
  return scopeCode.toUpperCase().replace(/_/g, "");
}

/**
 * Reverses sessionController.ts's testType/scopeCode choice (LA-APP-COMPLETION-001
 * Phase C1) back into the mode label the frontend's SessionResult type uses.
 * Read directly off the test_code string so a resumed/reloaded attempt
 * (envelope.ts) doesn't need a second query to know how to render itself —
 * SUBJ/UNIT -> subject-wise, MOCK+ALL -> full-mock, MOCK+IMAGES ->
 * image-practice (docs/BUGS.md#E1-E3), MOCK+CUSTOM -> custom.
 */
export function deriveSessionModeFromTestCode(testCode: string): "subject-wise" | "full-mock" | "image-practice" | "custom" {
  const match = testCode.match(/^LMN-[A-Z]+-(MOCK|SUBJ|CHAP|TOPIC|UNIT)-([A-Z0-9]+)-\d{6}$/);
  if (!match) return "custom";
  const [, testType, scopeCode] = match;
  if (testType === "SUBJ" || testType === "UNIT") return "subject-wise";
  if (testType === "MOCK" && scopeCode === "ALL") return "full-mock";
  if (testType === "MOCK" && scopeCode === "IMAGES") return "image-practice";
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
