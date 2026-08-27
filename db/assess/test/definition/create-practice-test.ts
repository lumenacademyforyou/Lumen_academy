import { pool } from "../../../shared/pool.js";
import { createTest, type CreateTestSectionInput, type CreatedTest } from "./create-test.js";
import { generateTestCode, type TestTypeCode } from "./test-code.js";

/**
 * createPracticeTest — the convenience layer createTest() didn't have:
 * subject-wise / chapter-wise / topic-wise / unit-wise (and, for the
 * multi-line case, full-mock) test creation, without the caller having to
 * hand-craft a catalog.exam_pattern + pattern_section first.
 *
 * The underlying assembly mechanism (assess.test_blueprint.syllabus_node_id
 * + include_descendants, db/assess/test/generation/assemble.ts) already
 * supported all of these scopes since TE-P3 — createTest() just required a
 * pre-existing exam_pattern shaped to match, which nothing had ever created
 * for anything other than the one real NEET_E2E_FIXTURE pattern. This finds
 * or creates that pattern automatically.
 *
 * Reuse rule: a pattern_section has a subject_id and a question_count but no
 * node — node-scoping lives on test_blueprint (per test), not on the
 * pattern (a shape shared across tests). So a single-line "give me N
 * questions from subject S" pattern shape is reusable across EVERY chapter/
 * topic/unit within that subject, not just one — this function searches for
 * an existing single-section pattern of that exact (subject, count) shape
 * before creating a new one. Multi-line (MOCK, several subjects at once)
 * always creates a fresh pattern — matching an exact multi-subject shape is
 * a fuller search this function doesn't attempt yet, since no multi-subject
 * practice test has been proven against real content volume yet either.
 */

export interface PracticeTestLine {
  subjectId: string;
  syllabusNodeId?: string | null;
  includeDescendants?: boolean;
  difficultyBand?: string | null;
  questionFormat?: string | null;
  pickCount: number;
  sectionName: string;
}

export interface CreatePracticeTestInput {
  examId: string;
  examCode: string;
  cycleId?: string;
  schemeId?: string;
  testType: TestTypeCode;
  /** For test_code's SCOPE_CODE segment — a subject_code, a syllabus_node.tag_code, or "ALL" for MOCK. */
  scopeCode: string;
  title: string;
  durationMinutes: number;
  createdBy: string;
  lines: PracticeTestLine[];
}

async function resolveCycleId(examId: string, given?: string): Promise<string> {
  if (given) return given;
  const res = await pool.query<{ cycle_id: string }>(
    `select cycle_id from catalog.exam_cycle where exam_id = $1 order by cycle_year desc limit 1`,
    [examId]
  );
  if (res.rowCount === 0) throw new Error(`createPracticeTest: no catalog.exam_cycle exists for exam ${examId} — create one first`);
  return res.rows[0].cycle_id;
}

async function resolveSchemeId(given?: string): Promise<{ schemeId: string; correctMarks: string }> {
  const res = given
    ? await pool.query<{ scheme_id: string; correct_marks: string }>(`select scheme_id, correct_marks from catalog.marking_scheme where scheme_id = $1`, [given])
    : await pool.query<{ scheme_id: string; correct_marks: string }>(`select scheme_id, correct_marks from catalog.marking_scheme where scheme_code = 'NEET_STANDARD'`);
  if (res.rowCount === 0) throw new Error("createPracticeTest: no usable catalog.marking_scheme found (pass schemeId explicitly, or seed NEET_STANDARD)");
  return { schemeId: res.rows[0].scheme_id, correctMarks: res.rows[0].correct_marks };
}

/** Only meaningful for the single-line case — see file header. */
async function findReusableSingleLinePattern(
  cycleId: string,
  schemeId: string,
  line: PracticeTestLine
): Promise<{ patternId: string; patternSectionId: string } | null> {
  const res = await pool.query<{ pattern_id: string; pattern_section_id: string }>(
    `select p.pattern_id, ps.pattern_section_id
       from catalog.exam_pattern p
       join catalog.pattern_section ps on ps.pattern_id = p.pattern_id
      where p.cycle_id = $1
        and p.scheme_id = $2
        and p.total_questions = $3
        and ps.subject_id = $4
        and ps.question_count = $3
        and (select count(*) from catalog.pattern_section ps2 where ps2.pattern_id = p.pattern_id) = 1
      limit 1`,
    [cycleId, schemeId, line.pickCount, line.subjectId]
  );
  return res.rowCount && res.rowCount > 0 ? { patternId: res.rows[0].pattern_id, patternSectionId: res.rows[0].pattern_section_id } : null;
}

export async function createPracticeTest(input: CreatePracticeTestInput): Promise<CreatedTest> {
  if (input.lines.length === 0) throw new Error("createPracticeTest: at least one line is required");

  const cycleId = await resolveCycleId(input.examId, input.cycleId);
  const { schemeId, correctMarks } = await resolveSchemeId(input.schemeId);

  let patternId: string;
  let patternSectionIds: string[];
  let patternWasCreatedThisCall = false;

  const reusable = input.lines.length === 1 ? await findReusableSingleLinePattern(cycleId, schemeId, input.lines[0]) : null;
  if (reusable) {
    patternId = reusable.patternId;
    patternSectionIds = [reusable.patternSectionId];
  } else {
    patternWasCreatedThisCall = true;
    const totalQuestions = input.lines.reduce((sum, l) => sum + l.pickCount, 0);
    const totalMarks = (Number(correctMarks) * totalQuestions).toString();

    const versionRes = await pool.query<{ next: number }>(
      `select coalesce(max(version_no), 0) + 1 as next from catalog.exam_pattern where cycle_id = $1`,
      [cycleId]
    );
    const versionNo = versionRes.rows[0].next;

    // is_current=false deliberately — catalog.uq_exam_pattern_current_per_cycle
    // allows only ONE is_current=true pattern per cycle (the cycle's official
    // exam pattern). A practice-test shape is an auxiliary pattern, not that;
    // createTest() itself doesn't require is_current, only that the pattern
    // row and its sections exist and are self-consistent.
    const patternRes = await pool.query<{ pattern_id: string }>(
      `insert into catalog.exam_pattern (cycle_id, scheme_id, version_no, total_questions, total_marks, duration_minutes, is_current)
       values ($1, $2, $3, $4, $5, $6, false)
       returning pattern_id`,
      [cycleId, schemeId, versionNo, totalQuestions, totalMarks, input.durationMinutes]
    );
    patternId = patternRes.rows[0].pattern_id;

    patternSectionIds = [];
    let seq = 1;
    for (const line of input.lines) {
      const sectionRes = await pool.query<{ pattern_section_id: string }>(
        `insert into catalog.pattern_section (pattern_id, subject_id, scheme_id, section_name, sequence_no, question_count)
         values ($1, $2, $3, $4, $5, $6)
         returning pattern_section_id`,
        [patternId, line.subjectId, schemeId, line.sectionName, seq, line.pickCount]
      );
      patternSectionIds.push(sectionRes.rows[0].pattern_section_id);
      seq++;
    }
  }

  const testCode = await generateTestCode(input.examCode, input.testType, input.scopeCode);

  const sections: CreateTestSectionInput[] = input.lines.map((line, i) => ({
    patternSectionId: patternSectionIds[i],
    sectionName: line.sectionName,
    sequenceNo: i + 1,
    blueprint: {
      subjectId: line.subjectId,
      syllabusNodeId: line.syllabusNodeId ?? null,
      includeDescendants: line.includeDescendants ?? true,
      difficultyBand: line.difficultyBand ?? null,
      questionFormat: line.questionFormat ?? null,
      pickCount: line.pickCount,
    },
  }));

  // See db/scripts/compose-fixed-paper-i17.ts's identical comment: createTest()
  // manages its own internal transaction and has no visibility into the
  // pattern/sections just inserted above via bare pool.query calls, so a
  // failure here can't roll those back on its own. Only clean up a pattern
  // this call actually created — never delete a reused, possibly-shared one.
  try {
    return await createTest({
      testCode,
      patternId,
      createdBy: input.createdBy,
      title: input.title,
      examId: input.examId,
      sourceType: "generated",
      durationMinutes: input.durationMinutes,
      sections,
    });
  } catch (err) {
    if (patternWasCreatedThisCall) {
      await pool.query(`delete from catalog.pattern_section where pattern_id = $1`, [patternId]);
      await pool.query(`delete from catalog.exam_pattern where pattern_id = $1`, [patternId]);
    }
    throw err;
  }
}
