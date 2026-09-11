/**
 * createTest (LA-BE-ENGINE-001 TE-P3). Writes assess.test, its test_section
 * rows and, for BLUEPRINT mode, its test_blueprint rows, inside one
 * transaction. Validates that the sections supplied are consistent with the
 * referenced catalog.exam_pattern before writing anything.
 *
 * D-1: source_type = 'generated' is this schema's assembly_mode = BLUEPRINT
 * signal (see db/migrations/018_test_engine.sql's header comment);
 * 'authored' or 'pyq' means FIXED. A BLUEPRINT section must carry a
 * `blueprint` input; a FIXED section must not — mixing the two within one
 * test is rejected rather than silently ignored.
 */
import { pool } from "../../../shared/pool.js";
import { ForeignKeyViolationError } from "../../../shared/errors.js";

export type TestSourceType = "authored" | "pyq" | "generated";

export interface CreateTestBlueprintInput {
  subjectId: string;
  syllabusNodeId?: string | null;
  includeDescendants?: boolean;
  difficultyBand?: string | null;
  questionFormat?: string | null;
  /** Image-based test type (docs/BUGS.md#E1-E3) — restrict this line to has_image=true questions only. */
  hasImageOnly?: boolean;
  pickCount: number;
}

export interface CreateTestSectionInput {
  patternSectionId: string;
  sectionName: string;
  sequenceNo: number;
  blueprint?: CreateTestBlueprintInput;
}

export interface CreateTestInput {
  testCode: string;
  patternId: string;
  cycleId?: string | null;
  createdBy: string;
  title: string;
  testMode?: string | null;
  examId?: string | null;
  sourceType: TestSourceType;
  durationMinutes?: number | null;
  windowOpensAt?: string | null;
  windowClosesAt?: string | null;
  sections: CreateTestSectionInput[];
}

export interface CreatedTestSection {
  testSectionId: string;
  patternSectionId: string;
  sectionName: string;
  sequenceNo: number;
  blueprintId: string | null;
}

export interface CreatedTest {
  testId: string;
  testCode: string;
  testStatus: string;
  sections: CreatedTestSection[];
}

/**
 * @throws {ForeignKeyViolationError} the pattern, a pattern_section, or the
 *   syllabus_node/subject referenced by a blueprint input does not exist
 * @throws {Error} sections are inconsistent with the referenced pattern
 *   (wrong pattern_section, mismatched pick_count, or the sections' total
 *   question count doesn't sum to the pattern's total_questions), or a
 *   BLUEPRINT test has a section without a blueprint input (or vice versa)
 */
export async function createTest(input: CreateTestInput): Promise<CreatedTest> {
  if (input.sections.length === 0) {
    throw new Error("createTest: at least one section is required");
  }
  const isBlueprintMode = input.sourceType === "generated";
  for (const section of input.sections) {
    if (isBlueprintMode && !section.blueprint) {
      throw new Error(`createTest: section "${section.sectionName}" is missing a blueprint input for a BLUEPRINT-mode test (source_type='generated')`);
    }
    if (!isBlueprintMode && section.blueprint) {
      throw new Error(`createTest: section "${section.sectionName}" has a blueprint input but source_type is '${input.sourceType}' (FIXED mode) — blueprint rows only apply to BLUEPRINT mode`);
    }
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const patternRes = await client.query<{ pattern_id: string; total_questions: number; total_marks: string }>(
      `select pattern_id, total_questions, total_marks from catalog.exam_pattern where pattern_id = $1`,
      [input.patternId]
    );
    if (patternRes.rowCount === 0) {
      throw new ForeignKeyViolationError("assess.test", "pattern_id");
    }
    const pattern = patternRes.rows[0];

    const patternSectionIds = input.sections.map((s) => s.patternSectionId);
    const patternSectionRes = await client.query<{ pattern_section_id: string; question_count: number; subject_id: string }>(
      `select pattern_section_id, question_count, subject_id
         from catalog.pattern_section
        where pattern_id = $1 and pattern_section_id = any($2::uuid[])`,
      [input.patternId, patternSectionIds]
    );
    const patternSectionById = new Map(patternSectionRes.rows.map((r) => [r.pattern_section_id, r]));
    for (const section of input.sections) {
      const ps = patternSectionById.get(section.patternSectionId);
      if (!ps) {
        throw new ForeignKeyViolationError("assess.test_section", `pattern_section_id (${section.patternSectionId} does not belong to pattern ${input.patternId})`);
      }
      if (section.blueprint && section.blueprint.pickCount !== ps.question_count) {
        throw new Error(
          `createTest: section "${section.sectionName}" blueprint.pickCount (${section.blueprint.pickCount}) does not match its pattern_section's question_count (${ps.question_count})`
        );
      }
    }

    const totalRequested = input.sections.reduce((sum, s) => sum + patternSectionById.get(s.patternSectionId)!.question_count, 0);
    if (totalRequested !== pattern.total_questions) {
      throw new Error(
        `createTest: sections' combined question_count (${totalRequested}) does not equal pattern ${input.patternId}'s total_questions (${pattern.total_questions})`
      );
    }

    const testRes = await client.query<{ test_id: string; test_status: string }>(
      `insert into assess.test
         (test_code, pattern_id, cycle_id, created_by, title, test_mode, exam_id, source_type,
          duration_minutes, window_opens_at, window_closes_at, test_status, total_marks)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'draft', $12)
       returning test_id, test_status`,
      [
        input.testCode,
        input.patternId,
        input.cycleId ?? null,
        input.createdBy,
        input.title,
        input.testMode ?? null,
        input.examId ?? null,
        input.sourceType,
        input.durationMinutes ?? null,
        input.windowOpensAt ?? null,
        input.windowClosesAt ?? null,
        pattern.total_marks,
      ]
    );
    const testId = testRes.rows[0].test_id;

    const createdSections: CreatedTestSection[] = [];
    for (const section of input.sections) {
      const sectionRes = await client.query<{ test_section_id: string }>(
        `insert into assess.test_section (test_id, pattern_section_id, section_name, sequence_no, question_count)
         values ($1, $2, $3, $4, $5)
         returning test_section_id`,
        [testId, section.patternSectionId, section.sectionName, section.sequenceNo, patternSectionById.get(section.patternSectionId)!.question_count]
      );
      const testSectionId = sectionRes.rows[0].test_section_id;

      let blueprintId: string | null = null;
      if (section.blueprint) {
        const bp = section.blueprint;
        const blueprintRes = await client.query<{ blueprint_id: string }>(
          `insert into assess.test_blueprint
             (test_id, test_section_id, subject_id, syllabus_node_id, include_descendants, difficulty_band, question_format, has_image_only, pick_count)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           returning blueprint_id`,
          [
            testId,
            testSectionId,
            bp.subjectId,
            bp.syllabusNodeId ?? null,
            bp.includeDescendants ?? true,
            bp.difficultyBand ?? null,
            bp.questionFormat ?? null,
            bp.hasImageOnly ?? false,
            bp.pickCount,
          ]
        );
        blueprintId = blueprintRes.rows[0].blueprint_id;
      }

      createdSections.push({
        testSectionId,
        patternSectionId: section.patternSectionId,
        sectionName: section.sectionName,
        sequenceNo: section.sequenceNo,
        blueprintId,
      });
    }

    await client.query("commit");
    return { testId, testCode: input.testCode, testStatus: testRes.rows[0].test_status, sections: createdSections };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
