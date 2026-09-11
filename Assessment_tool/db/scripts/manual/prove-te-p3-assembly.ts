/**
 * TE-P3 stop-gate proof (LA-BE-ENGINE-001 Section 6). Exercises createTest,
 * ingestFixedPaper and assembleForAttempt against the live database, using
 * the real 20-question fixture restored by db/scripts/seed/02_content.ts +
 * 03_assess_fixture.ts. Not a permanent e2e script (that's TE-P7's job) —
 * a one-off proof run whose output is the phase's stop gate evidence.
 *
 * Leaves its rows live (test_code-prefixed TE_P3_PROOF_*, catalog rows
 * marked is_current=false) rather than rolling back, matching this
 * project's existing convention for fixture scripts
 * (db/scripts/seed/03_assess_fixture.ts) — genuine data, not torn down.
 *
 * Usage: npx tsx db/scripts/prove-te-p3-assembly.ts
 */
import { pool } from "../../shared/pool.js";
import { createTest } from "../../assess/test/definition/create-test.js";
import { ingestFixedPaper } from "../../assess/test/definition/ingest-paper.js";
import { assembleForAttempt, type AssembleResult } from "../../assess/test/generation/assemble.js";
import { PoolInsufficientError } from "../../shared/errors.js";

async function main() {
  const examRes = await pool.query<{ exam_id: string; cycle_id: string }>(
    `select e.exam_id, c.cycle_id from catalog.exam e join catalog.exam_cycle c on c.exam_id = e.exam_id where e.exam_code = 'NEET' and c.cycle_year = 2027`
  );
  const { exam_id: examId, cycle_id: cycleId } = examRes.rows[0];
  const studentRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = 'student@lumen.internal'`);
  const studentId = studentRes.rows[0].user_id;
  const systemUserRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = 'legacy-import@lumen.internal'`);
  const systemUserId = systemUserRes.rows[0].user_id;
  const physicsRes = await pool.query<{ subject_id: string }>(`select subject_id from catalog.subject where subject_code = 'PHY'`);
  const physicsSubjectId = physicsRes.rows[0].subject_id;

  console.log("=== Part 1: FIXED-mode createTest + ingestFixedPaper ===");
  const realPatternRes = await pool.query<{ pattern_id: string }>(
    `select pattern_id from catalog.exam_pattern where cycle_id = $1 and version_no = 1`,
    [cycleId]
  );
  const realPatternId = realPatternRes.rows[0].pattern_id;
  const patternSectionsRes = await pool.query<{ pattern_section_id: string; subject_id: string; question_count: number; section_name: string; sequence_no: number }>(
    `select pattern_section_id, subject_id, question_count, section_name, sequence_no from catalog.pattern_section where pattern_id = $1 order by sequence_no`,
    [realPatternId]
  );

  const fixedTest = await createTest({
    testCode: "TE_P3_PROOF_FIXED",
    patternId: realPatternId,
    cycleId,
    createdBy: systemUserId,
    title: "TE-P3 proof — FIXED paper",
    examId,
    sourceType: "authored",
    durationMinutes: 60,
    sections: patternSectionsRes.rows.map((ps) => ({
      patternSectionId: ps.pattern_section_id,
      sectionName: ps.section_name,
      sequenceNo: ps.sequence_no,
    })),
  });
  console.log(`createTest (FIXED): test_id=${fixedTest.testId}, ${fixedTest.sections.length} sections`);

  const ingestInput = { testId: fixedTest.testId, sections: [] as { testSectionId: string; questionIds: string[] }[] };
  for (const section of fixedTest.sections) {
    const ps = patternSectionsRes.rows.find((r) => r.pattern_section_id === section.patternSectionId)!;
    const qRes = await pool.query<{ question_id: string }>(
      `select q.question_id from content.question q join content.question_node_map qnm on qnm.question_id = q.question_id
        join catalog.syllabus_node sn on sn.node_id = qnm.node_id where sn.subject_id = $1 order by q.question_uid`,
      [ps.subject_id]
    );
    ingestInput.sections.push({ testSectionId: section.testSectionId, questionIds: qRes.rows.map((r) => r.question_id) });
  }
  const ingestResult = await ingestFixedPaper(ingestInput);
  console.log(`ingestFixedPaper: inserted ${ingestResult.inserted} test_question rows`);

  const readBack = await pool.query<{ test_section_id: string; question_id: string; sequence_no: number }>(
    `select test_section_id, question_id, sequence_no from assess.test_question where test_section_id = any($1::uuid[]) order by test_section_id, sequence_no`,
    [fixedTest.sections.map((s) => s.testSectionId)]
  );
  const firstSection = ingestInput.sections[0];
  const readBackOrder = readBack.rows.filter((r) => r.test_section_id === firstSection.testSectionId).map((r) => r.question_id);
  const orderMatches = JSON.stringify(readBackOrder) === JSON.stringify(firstSection.questionIds);
  console.log(`read-back order matches ingested order: ${orderMatches ? "PASS" : "FAIL"}`);

  console.log("\n=== Part 2: BLUEPRINT-mode assembleForAttempt (disjoint picks) ===");
  // No natural unique constraint on (cycle_id, version_no) exists to upsert
  // on (docs/DB_STATE.md §4.2) — select-or-insert explicitly instead, same
  // pattern db/scripts/seed/03_assess_fixture.ts already uses for this table.
  let proofPatternId: string;
  const existingProofPattern = await pool.query<{ pattern_id: string }>(`select pattern_id from catalog.exam_pattern where cycle_id = $1 and version_no = 999`, [cycleId]);
  if (existingProofPattern.rowCount && existingProofPattern.rowCount > 0) {
    proofPatternId = existingProofPattern.rows[0].pattern_id;
  } else {
    const schemeRes = await pool.query<{ scheme_id: string }>(`select scheme_id from catalog.exam_pattern where pattern_id = $1`, [realPatternId]);
    const inserted = await pool.query<{ pattern_id: string }>(
      `insert into catalog.exam_pattern (cycle_id, scheme_id, version_no, total_questions, total_marks, duration_minutes, is_current)
       values ($1, $2, 999, 2, 8, 5, false) returning pattern_id`,
      [cycleId, schemeRes.rows[0].scheme_id]
    );
    proofPatternId = inserted.rows[0].pattern_id;
  }
  await pool.query(`delete from catalog.pattern_section where pattern_id = $1`, [proofPatternId]);
  const proofSectionRes = await pool.query<{ pattern_section_id: string }>(
    `insert into catalog.pattern_section (pattern_id, subject_id, section_name, sequence_no, question_count)
     values ($1, $2, 'Physics (blueprint proof)', 1, 2) returning pattern_section_id`,
    [proofPatternId, physicsSubjectId]
  );
  const proofPatternSectionId = proofSectionRes.rows[0].pattern_section_id;

  async function makeBlueprintTest(code: string, pickCount: number) {
    await pool.query(`delete from assess.test where test_code = $1`, [code]);
    return createTest({
      testCode: code,
      patternId: proofPatternId,
      cycleId,
      createdBy: systemUserId,
      title: `TE-P3 proof — BLUEPRINT (${code})`,
      examId,
      sourceType: "generated",
      durationMinutes: 5,
      sections: [
        {
          patternSectionId: proofPatternSectionId,
          sectionName: "Physics (blueprint proof)",
          sequenceNo: 1,
          blueprint: { subjectId: physicsSubjectId, pickCount },
        },
      ],
    });
  }

  const round1Test = await makeBlueprintTest("TE_P3_PROOF_BLUEPRINT_1", 2);
  const round1: AssembleResult = await assembleForAttempt(round1Test.testId, studentId);
  console.log(`assembly round 1: picked ${round1.sections[0].questionIds.join(", ")}`);

  // Simulate what TE-P4's submitAttempt will eventually do: mark these
  // questions seen at attempt_seq 1, so round 2's exclusion has something
  // real to exclude.
  for (const questionId of round1.sections[0].questionIds) {
    await pool.query(
      `insert into assess.user_question_seen (user_id, question_id, last_seen_attempt_seq)
       values ($1, $2, 1)
       on conflict (user_id, question_id) do update set last_seen_attempt_seq = excluded.last_seen_attempt_seq, times_seen = assess.user_question_seen.times_seen + 1`,
      [studentId, questionId]
    );
  }

  const round2Test = await makeBlueprintTest("TE_P3_PROOF_BLUEPRINT_2", 2);
  const round2: AssembleResult = await assembleForAttempt(round2Test.testId, studentId);
  console.log(`assembly round 2: picked ${round2.sections[0].questionIds.join(", ")}`);

  const overlap = round1.sections[0].questionIds.filter((id) => round2.sections[0].questionIds.includes(id));
  console.log(`disjoint from round 1: ${overlap.length === 0 ? "PASS" : `FAIL (overlap: ${overlap.join(", ")})`}`);

  console.log("\n=== Part 3: POOL_INSUFFICIENT on an over-narrow scope ===");
  const round3Test = await makeBlueprintTest("TE_P3_PROOF_BLUEPRINT_3", 2);
  // pick_count on the blueprint row itself must equal pattern_section's
  // question_count per createTest's own validation, so make the pattern
  // section (and blueprint) ask for more than the physics pool could ever
  // hold, deliberately over-narrow.
  await pool.query(`update catalog.pattern_section set question_count = 999 where pattern_section_id = $1`, [proofPatternSectionId]);
  await pool.query(`update catalog.exam_pattern set total_questions = 999 where pattern_id = $1`, [proofPatternId]);
  await pool.query(`update assess.test_blueprint set pick_count = 999 where test_id = $1`, [round3Test.testId]);
  try {
    await assembleForAttempt(round3Test.testId, studentId);
    console.log("FAIL: expected PoolInsufficientError, assembly succeeded instead");
  } catch (err) {
    if (err instanceof PoolInsufficientError) {
      console.log(`PASS — PoolInsufficientError: blueprint=${err.blueprintId}, section=${err.testSectionId}, requested=${err.requested}, available=${err.available}`);
    } else {
      throw err;
    }
  }
  // restore for a clean repeated run
  await pool.query(`update catalog.pattern_section set question_count = 2 where pattern_section_id = $1`, [proofPatternSectionId]);
  await pool.query(`update catalog.exam_pattern set total_questions = 2 where pattern_id = $1`, [proofPatternId]);

  console.log("\n=== Part 4: EXPLAIN ANALYZE of the candidate-pool query ===");
  const explainRes = await pool.query(
    `explain analyze
     select bp.blueprint_id, bp.test_section_id, bp.pick_count, picked.question_id
       from assess.test_blueprint bp
       cross join lateral (
         select q.question_id
           from content.question q
           join content.question_node_map qnm on qnm.question_id = q.question_id
           join catalog.syllabus_node sn on sn.node_id = qnm.node_id
          where sn.subject_id = bp.subject_id
            and q.lifecycle_status = 'published'
            and not exists (select 1 from assess.user_question_seen s where s.user_id = $2 and s.question_id = q.question_id and s.last_seen_attempt_seq > ($3::int - 50))
          order by md5(q.question_id::text || $4::text)
          limit bp.pick_count
       ) picked
      where bp.test_id = $1`,
    [round1Test.testId, studentId, 1, "explain-seed"]
  );
  console.log(explainRes.rows.map((r: Record<string, string>) => r["QUERY PLAN"]).join("\n"));

  await pool.end();
}

main().catch((err) => {
  console.error("prove-te-p3-assembly failed:", err);
  process.exitCode = 1;
});
