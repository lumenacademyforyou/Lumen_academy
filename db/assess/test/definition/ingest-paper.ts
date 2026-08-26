/**
 * ingestFixedPaper (LA-BE-ENGINE-001 TE-P3). Accepts an ordered list of
 * question identifiers per section of a FIXED-mode test, validates every
 * question in one pass, and rejects the whole payload with a per-item error
 * list if anything is wrong — a partially ingested paper is worse than a
 * rejected one.
 *
 * Substitution (docs/DB_STATE.md / docs/OPEN_ITEMS.md): the brief's
 * "registered for the test's exam_subject via question_exam_usage" has no
 * live equivalent — that table doesn't exist in this schema. The closest
 * real check is that the question is tagged (content.question_node_map) to
 * a syllabus_node belonging to the same subject as the target section's
 * catalog.pattern_section.subject_id — checked here instead.
 *
 * Also not checked: "matches the section's permitted format" — real
 * catalog.pattern_section has no format-restriction column to check against
 * (only assess.test_blueprint does, and that's BLUEPRINT-only). Recorded as
 * a known gap rather than invented.
 */
import { pool } from "../../../shared/pool.js";
import { PaperInvalidError, ForeignKeyViolationError } from "../../../shared/errors.js";

export interface IngestSectionInput {
  testSectionId: string;
  questionIds: string[]; // in display order
}

export interface IngestFixedPaperInput {
  testId: string;
  sections: IngestSectionInput[];
}

interface CandidateRow {
  question_id: string;
  lifecycle_status: string;
  tagged_subject_ids: string[];
}

export async function ingestFixedPaper(input: IngestFixedPaperInput): Promise<{ inserted: number }> {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const testSectionIds = input.sections.map((s) => s.testSectionId);
    const sectionRes = await client.query<{ test_section_id: string; subject_id: string }>(
      `select ts.test_section_id, ps.subject_id
         from assess.test_section ts
         join catalog.pattern_section ps on ps.pattern_section_id = ts.pattern_section_id
        where ts.test_id = $1 and ts.test_section_id = any($2::uuid[])`,
      [input.testId, testSectionIds]
    );
    const subjectIdBySection = new Map(sectionRes.rows.map((r) => [r.test_section_id, r.subject_id]));
    for (const section of input.sections) {
      if (!subjectIdBySection.has(section.testSectionId)) {
        throw new ForeignKeyViolationError("assess.test_question", `test_section_id (${section.testSectionId} does not belong to test ${input.testId})`);
      }
    }

    const allQuestionIds = [...new Set(input.sections.flatMap((s) => s.questionIds))];
    const candidateRes = await client.query<CandidateRow>(
      `select q.question_id, q.lifecycle_status,
              coalesce(array_agg(distinct sn.subject_id) filter (where sn.subject_id is not null), '{}') as tagged_subject_ids
         from content.question q
         left join content.question_node_map qnm on qnm.question_id = q.question_id
         left join catalog.syllabus_node sn on sn.node_id = qnm.node_id
        where q.question_id = any($1::uuid[])
        group by q.question_id, q.lifecycle_status`,
      [allQuestionIds]
    );
    const candidateById = new Map(candidateRes.rows.map((r) => [r.question_id, r]));

    const itemErrors: { testSectionId: string; questionId: string; reason: string }[] = [];
    for (const section of input.sections) {
      const subjectId = subjectIdBySection.get(section.testSectionId);
      section.questionIds.forEach((questionId, index) => {
        const candidate = candidateById.get(questionId);
        if (!candidate) {
          itemErrors.push({ testSectionId: section.testSectionId, questionId, reason: `question ${questionId} does not exist (item ${index + 1})` });
          return;
        }
        if (candidate.lifecycle_status !== "published") {
          itemErrors.push({ testSectionId: section.testSectionId, questionId, reason: `question ${questionId} has lifecycle_status '${candidate.lifecycle_status}', not 'published'` });
          return;
        }
        if (!candidate.tagged_subject_ids.includes(subjectId!)) {
          itemErrors.push({
            testSectionId: section.testSectionId,
            questionId,
            reason: `question ${questionId} is not tagged (via content.question_node_map) to any syllabus_node of subject ${subjectId} — this section's subject`,
          });
        }
      });
    }
    if (itemErrors.length > 0) {
      throw new PaperInvalidError(itemErrors);
    }

    let inserted = 0;
    for (const section of input.sections) {
      await client.query(`delete from assess.test_question where test_section_id = $1`, [section.testSectionId]);
      let sequenceNo = 1;
      for (const questionId of section.questionIds) {
        // question_revision is left for assess.trg_test_question_revision to
        // fill from content.question.revision_no — not hard-coded here.
        await client.query(
          `insert into assess.test_question (test_section_id, question_id, sequence_no)
           values ($1, $2, $3)`,
          [section.testSectionId, questionId, sequenceNo]
        );
        sequenceNo++;
        inserted++;
      }
    }

    await client.query("commit");
    return { inserted };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}
