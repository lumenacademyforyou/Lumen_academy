import { pool } from "../../shared/pool.js";

// STAGE 6 prerequisite — assembles ONE real test from the 20 real questions
// migrated in 02_content.ts, so there's something genuine for the e2e proof
// to actually attempt. Not fabricated content: every question, option and
// syllabus link here is real data already in the database; this script only
// adds the structural rows (marking scheme, pattern, sections, test) needed
// to assemble them into an attemptable paper — exactly what Stage 6 asks for
// ("request a paper for a seeded chapter").
//
// Marking scheme is +4/-1/0, the standard NEET scheme named explicitly and
// repeatedly throughout the design pack (LA-ARC-001, LA-DBD-004b) — not
// invented. incorrect_marks stored as -1 per the sign convention confirmed
// earlier for this schema.
//
// Idempotent: reuses existing rows by natural key where one exists
// (marking_scheme.scheme_code, exam_cycle by year, exam_pattern by
// cycle+version, test by test_code); test_section/test_question are
// recreated each run (delete-then-insert) since they have no natural key.
//
// Usage: npx tsx db/scripts/seed/03_assess_fixture.ts

async function main() {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const examRes = await client.query<{ exam_id: string }>(`select exam_id from catalog.exam where exam_code = 'NEET'`);
    if (examRes.rowCount === 0) throw new Error("catalog.exam NEET not found — run 01_catalog.ts first");
    const examId = examRes.rows[0].exam_id;

    const schemeRes = await client.query<{ scheme_id: string }>(
      `insert into catalog.marking_scheme (scheme_code, correct_marks, incorrect_marks, unattempted_marks)
       values ('NEET_STANDARD', 4, -1, 0)
       on conflict (scheme_code) do update set scheme_code = excluded.scheme_code
       returning scheme_id`
    );
    const schemeId = schemeRes.rows[0].scheme_id;
    console.log(`marking_scheme: ${schemeId}`);

    let cycleRes = await client.query<{ cycle_id: string }>(
      `select cycle_id from catalog.exam_cycle where exam_id = $1 and cycle_year = 2027`,
      [examId]
    );
    let cycleId: string;
    if (cycleRes.rowCount && cycleRes.rowCount > 0) {
      cycleId = cycleRes.rows[0].cycle_id;
    } else {
      const inserted = await client.query<{ cycle_id: string }>(
        `insert into catalog.exam_cycle (exam_id, cycle_year, cycle_status) values ($1, 2027, 'upcoming') returning cycle_id`,
        [examId]
      );
      cycleId = inserted.rows[0].cycle_id;
    }
    console.log(`exam_cycle: ${cycleId}`);

    let patternRes = await client.query<{ pattern_id: string }>(
      `select pattern_id from catalog.exam_pattern where cycle_id = $1 and version_no = 1`,
      [cycleId]
    );
    let patternId: string;
    if (patternRes.rowCount && patternRes.rowCount > 0) {
      patternId = patternRes.rows[0].pattern_id;
    } else {
      const inserted = await client.query<{ pattern_id: string }>(
        `insert into catalog.exam_pattern (cycle_id, scheme_id, version_no, total_questions, total_marks, duration_minutes, is_current)
         values ($1, $2, 1, 20, 80, 60, true)
         returning pattern_id`,
        [cycleId, schemeId]
      );
      patternId = inserted.rows[0].pattern_id;
    }
    console.log(`exam_pattern: ${patternId}`);

    // one pattern_section per subject that actually has migrated questions
    const questionsBySubject = await client.query<{ subject_id: string; subject_code: string; question_id: string; question_count: string }>(
      `select s.subject_id, s.subject_code, count(*)::text as question_count
         from content.question q
         join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
         join catalog.subject s on s.subject_id = sn.subject_id
        group by s.subject_id, s.subject_code`
    );

    const patternSectionIdBySubject = new Map<string, string>();
    let seq = 1;
    for (const row of questionsBySubject.rows) {
      const existing = await client.query<{ pattern_section_id: string }>(
        `select pattern_section_id from catalog.pattern_section where pattern_id = $1 and subject_id = $2`,
        [patternId, row.subject_id]
      );
      let patternSectionId: string;
      if (existing.rowCount && existing.rowCount > 0) {
        patternSectionId = existing.rows[0].pattern_section_id;
      } else {
        const inserted = await client.query<{ pattern_section_id: string }>(
          `insert into catalog.pattern_section (pattern_id, subject_id, scheme_id, section_name, sequence_no, question_count)
           values ($1, $2, $3, $4, $5, $6)
           returning pattern_section_id`,
          [patternId, row.subject_id, schemeId, row.subject_code, seq, Number(row.question_count)]
        );
        patternSectionId = inserted.rows[0].pattern_section_id;
      }
      patternSectionIdBySubject.set(row.subject_id, patternSectionId);
      seq++;
    }
    console.log(`pattern_section: ${patternSectionIdBySubject.size} sections`);

    const testRes = await client.query<{ test_id: string }>(
      `insert into assess.test (test_code, pattern_id, cycle_id, created_by, title, test_mode, total_marks, duration_minutes, test_status)
       values ('NEET_E2E_FIXTURE', $1, $2, $3, 'NEET E2E Fixture Test', 'practice', 80, 60, 'published')
       on conflict (test_code) do update set title = excluded.title
       returning test_id`,
      [patternId, cycleId, (await client.query<{ user_id: string }>(`select user_id from core.app_user where email = 'legacy-import@lumen.internal'`)).rows[0].user_id]
    );
    const testId = testRes.rows[0].test_id;
    console.log(`test: ${testId}`);

    // recreate sections + questions each run (no natural key to upsert on)
    await client.query(
      `delete from assess.test_question where test_section_id in (select test_section_id from assess.test_section where test_id = $1)`,
      [testId]
    );
    await client.query(`delete from assess.test_section where test_id = $1`, [testId]);

    let sectionSeq = 1;
    let totalQuestions = 0;
    for (const [subjectId, patternSectionId] of patternSectionIdBySubject) {
      const subjectCode = questionsBySubject.rows.find((r) => r.subject_id === subjectId)!.subject_code;
      const sectionRes = await client.query<{ test_section_id: string }>(
        `insert into assess.test_section (test_id, pattern_section_id, section_name, sequence_no)
         values ($1, $2, $3, $4)
         returning test_section_id`,
        [testId, patternSectionId, subjectCode, sectionSeq]
      );
      const testSectionId = sectionRes.rows[0].test_section_id;
      sectionSeq++;

      const questionsRes = await client.query<{ question_id: string }>(
        `select q.question_id
           from content.question q
           join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
          where sn.subject_id = $1
          order by q.question_uid`,
        [subjectId]
      );
      let qSeq = 1;
      for (const q of questionsRes.rows) {
        await client.query(
          `insert into assess.test_question (test_section_id, question_id, sequence_no) values ($1, $2, $3)`,
          [testSectionId, q.question_id, qSeq]
        );
        qSeq++;
        totalQuestions++;
      }
    }
    console.log(`test_section + test_question: ${sectionSeq - 1} sections, ${totalQuestions} questions`);

    await client.query("commit");
    console.log(`\ncommitted. test_id = ${testId}`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("03_assess_fixture failed:", err);
  process.exitCode = 1;
});
