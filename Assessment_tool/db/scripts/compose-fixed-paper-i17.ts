import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../shared/pool.js";
import { createTest } from "../assess/test/definition/create-test.js";
import { ingestFixedPaper } from "../assess/test/definition/ingest-paper.js";
import { generateTestCode, type TestTypeCode } from "../assess/test/definition/test-code.js";

// I-17 fixed paper composition (LA-PLAN-002 Day 2, 16:00-19:00 slot).
// Reads db/scripts/paper-i17-composition.json (the frozen, hand-verified
// question order + answer key) and seeds it as one FIXED-mode NEET test:
// catalog.exam_pattern + pattern_section (one per subject) + assess.test +
// test_section + test_question — using the same createTest/ingestFixedPaper
// building blocks TE-P3 already proved for FIXED mode
// (db/scripts/prove-te-p3-assembly.ts, "Part 1").
//
// Default is DRY RUN: resolves every question_uid to a live question_id and
// re-validates (published, exactly one correct option, has a
// content.question_solution row, tagged to the section's own subject) —
// zero writes. Pass --live to actually seed. The created test is always
// left test_status='draft' — publish it separately through the normal
// review path, per this repo's convention of never silently flipping
// content live.
//
// Usage:
//   npx tsx db/scripts/compose-fixed-paper-i17.ts [--live] [--file <path>]

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const REPORTS_DIR = path.resolve(REPO_ROOT, "db", "reports");
const DEFAULT_COMPOSITION_FILE = path.resolve(SCRIPT_DIR, "paper-i17-composition.json");

interface SectionSpec {
  subjectCode: string;
  sectionName: string;
  sequenceNo: number;
  questionUids: string[];
}

interface CompositionSpec {
  examCode: string;
  testType: TestTypeCode;
  scopeCode: string;
  title: string;
  testMode: string;
  durationMinutes: number;
  markingSchemeCode: string;
  sections: SectionSpec[];
}

interface QuestionRow {
  question_id: string;
  question_uid: string;
  lifecycle_status: string;
  correct_option_count: number;
  has_solution: boolean;
  tagged_subject_codes: string[];
}

interface ResolvedSection {
  subjectCode: string;
  sectionName: string;
  sequenceNo: number;
  questionIds: string[];
}

function parseArgs(argv: string[]) {
  const live = argv.includes("--live");
  const fileFlagIndex = argv.indexOf("--file");
  const file = fileFlagIndex >= 0 ? argv[fileFlagIndex + 1] : DEFAULT_COMPOSITION_FILE;
  return { live, file };
}

async function main() {
  const { live, file } = parseArgs(process.argv.slice(2));
  console.log(live ? "--- LIVE COMPOSE ---" : "--- DRY RUN: no writes will happen ---");
  console.log(`composition file: ${file}`);

  const spec: CompositionSpec = JSON.parse(fs.readFileSync(file, "utf-8"));

  const allUids = spec.sections.flatMap((s) => s.questionUids);
  const dupes = allUids.filter((u, i) => allUids.indexOf(u) !== i);
  if (dupes.length > 0) {
    console.error(`refusing to proceed: duplicate question_uid(s) across sections: ${[...new Set(dupes)].join(", ")}`);
    process.exitCode = 1;
    await pool.end();
    return;
  }

  const qRes = await pool.query<QuestionRow>(
    `select q.question_id, q.question_uid, q.lifecycle_status,
            (select count(*) from content.question_option qo where qo.question_id = q.question_id and qo.is_correct = true)::int as correct_option_count,
            exists(select 1 from content.question_solution qs where qs.question_id = q.question_id) as has_solution,
            coalesce(array_agg(distinct s.subject_code) filter (where s.subject_code is not null), '{}') as tagged_subject_codes
       from content.question q
       left join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
       left join catalog.subject s on s.subject_id = sn.subject_id
      where q.question_uid = any($1::text[])
      group by q.question_id, q.question_uid, q.lifecycle_status`,
    [allUids]
  );
  const byUid = new Map(qRes.rows.map((r) => [r.question_uid, r]));

  const errors: string[] = [];
  const resolvedSections: ResolvedSection[] = [];

  for (const section of spec.sections) {
    const questionIds: string[] = [];
    section.questionUids.forEach((uid, idx) => {
      const row = byUid.get(uid);
      if (!row) {
        errors.push(`section "${section.sectionName}" item ${idx + 1}: question_uid "${uid}" does not exist live`);
        return;
      }
      if (row.lifecycle_status !== "published") {
        errors.push(`section "${section.sectionName}" item ${idx + 1}: "${uid}" has lifecycle_status '${row.lifecycle_status}', not 'published'`);
        return;
      }
      if (row.correct_option_count !== 1) {
        errors.push(`section "${section.sectionName}" item ${idx + 1}: "${uid}" has ${row.correct_option_count} correct options, expected exactly 1`);
        return;
      }
      if (!row.has_solution) {
        errors.push(`section "${section.sectionName}" item ${idx + 1}: "${uid}" has no content.question_solution row`);
        return;
      }
      if (!row.tagged_subject_codes.includes(section.subjectCode)) {
        errors.push(
          `section "${section.sectionName}" item ${idx + 1}: "${uid}" is not tagged to subject ${section.subjectCode} (tagged: ${row.tagged_subject_codes.join(", ") || "none"})`
        );
        return;
      }
      questionIds.push(row.question_id);
    });
    resolvedSections.push({ subjectCode: section.subjectCode, sectionName: section.sectionName, sequenceNo: section.sequenceNo, questionIds });
  }

  const schemeRes = await pool.query<{ scheme_id: string; correct_marks: string }>(
    `select scheme_id, correct_marks from catalog.marking_scheme where scheme_code = $1`,
    [spec.markingSchemeCode]
  );
  if (schemeRes.rowCount === 0) {
    errors.push(`marking scheme "${spec.markingSchemeCode}" not found live`);
  }

  const totalQuestions = resolvedSections.reduce((sum, s) => sum + s.questionIds.length, 0);
  const correctMarks = schemeRes.rowCount ? Number(schemeRes.rows[0].correct_marks) : 0;
  const totalMarks = totalQuestions * correctMarks;

  const summary = {
    totalQuestions,
    totalMarks,
    durationMinutes: spec.durationMinutes,
    sections: resolvedSections.map((s) => ({
      subjectCode: s.subjectCode,
      sectionName: s.sectionName,
      questionCount: s.questionIds.length,
      marks: s.questionIds.length * correctMarks,
    })),
    errorCount: errors.length,
  };
  console.log("\nsummary:", JSON.stringify(summary, null, 2));
  if (errors.length > 0) {
    console.log("\nerrors:");
    errors.forEach((e) => console.log(` - ${e}`));
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(REPORTS_DIR, `compose_paper-i17_${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ compositionFile: file, summary, errors }, null, 2));
  console.log(`\nwrote ${reportPath}`);

  if (errors.length > 0) {
    console.error("\nrefusing to proceed: fix the errors above first.");
    process.exitCode = 1;
    await pool.end();
    return;
  }

  if (!live) {
    console.log("\ndry run complete — no exam_pattern/pattern_section/test/test_section/test_question rows written.");
    await pool.end();
    return;
  }

  // ---- LIVE ----
  const examRes = await pool.query<{ exam_id: string }>(`select exam_id from catalog.exam where exam_code = $1`, [spec.examCode]);
  if (examRes.rowCount === 0) throw new Error(`catalog.exam ${spec.examCode} not found`);
  const examId = examRes.rows[0].exam_id;

  const cycleRes = await pool.query<{ cycle_id: string }>(
    `select cycle_id from catalog.exam_cycle where exam_id = $1 order by cycle_year desc limit 1`,
    [examId]
  );
  if (cycleRes.rowCount === 0) throw new Error(`no catalog.exam_cycle exists for exam ${spec.examCode}`);
  const cycleId = cycleRes.rows[0].cycle_id;

  const schemeId = schemeRes.rows[0].scheme_id;

  const subjectRes = await pool.query<{ subject_id: string; subject_code: string }>(
    `select subject_id, subject_code from catalog.subject where subject_code = any($1::text[])`,
    [resolvedSections.map((s) => s.subjectCode)]
  );
  const subjectIdByCode = new Map(subjectRes.rows.map((r) => [r.subject_code, r.subject_id]));

  const versionRes = await pool.query<{ next: number }>(
    `select coalesce(max(version_no), 0) + 1 as next from catalog.exam_pattern where cycle_id = $1`,
    [cycleId]
  );
  const versionNo = versionRes.rows[0].next;

  // is_current=false deliberately, same reasoning as createPracticeTest
  // (db/assess/test/definition/create-practice-test.ts): only ONE
  // is_current=true pattern per cycle is allowed
  // (catalog.uq_exam_pattern_current_per_cycle), reserved for the cycle's
  // official pattern — this is a supplementary paper shape.
  const patternRes = await pool.query<{ pattern_id: string }>(
    `insert into catalog.exam_pattern (cycle_id, scheme_id, version_no, total_questions, total_marks, duration_minutes, is_current)
     values ($1, $2, $3, $4, $5, $6, false)
     returning pattern_id`,
    [cycleId, schemeId, versionNo, totalQuestions, totalMarks, spec.durationMinutes]
  );
  const patternId = patternRes.rows[0].pattern_id;
  console.log(`exam_pattern: ${patternId} (version_no=${versionNo})`);

  const patternSectionIdBySeq = new Map<number, string>();
  for (const section of resolvedSections) {
    const subjectId = subjectIdByCode.get(section.subjectCode);
    if (!subjectId) throw new Error(`catalog.subject "${section.subjectCode}" not found`);
    const sRes = await pool.query<{ pattern_section_id: string }>(
      `insert into catalog.pattern_section (pattern_id, subject_id, scheme_id, section_name, sequence_no, question_count)
       values ($1, $2, $3, $4, $5, $6)
       returning pattern_section_id`,
      [patternId, subjectId, schemeId, section.sectionName, section.sequenceNo, section.questionIds.length]
    );
    patternSectionIdBySeq.set(section.sequenceNo, sRes.rows[0].pattern_section_id);
  }
  console.log(`pattern_section: ${patternSectionIdBySeq.size} sections`);

  const testCode = await generateTestCode(spec.examCode, spec.testType, spec.scopeCode);
  console.log(`test_code: ${testCode}`);

  const systemUserRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = 'legacy-import@lumen.internal'`);
  if (systemUserRes.rowCount === 0) throw new Error("system app_user 'legacy-import@lumen.internal' not found");
  const createdBy = systemUserRes.rows[0].user_id;

  // createTest() manages its own internal transaction (assess.test +
  // test_section only) — it has no visibility into the catalog.exam_pattern/
  // pattern_section rows just inserted above via bare pool.query calls, so a
  // createTest() failure here can't roll those back on its own. Caught for
  // real once already (a bad test_mode value orphaned a pattern + 4
  // sections, cleaned up by hand) — this best-effort cleanup covers exactly
  // that failure mode. It deliberately does NOT try to clean up after
  // ingestFixedPaper failing below: by then assess.test/test_section already
  // exist and reference the pattern, so deleting it would violate their own
  // FK — that messier partial state is left for a human to inspect instead
  // of auto-repaired.
  let createdTest: Awaited<ReturnType<typeof createTest>>;
  try {
    createdTest = await createTest({
      testCode,
      patternId,
      cycleId,
      createdBy,
      title: spec.title,
      testMode: spec.testMode,
      examId,
      sourceType: "authored",
      durationMinutes: spec.durationMinutes,
      sections: resolvedSections.map((s) => ({
        patternSectionId: patternSectionIdBySeq.get(s.sequenceNo)!,
        sectionName: s.sectionName,
        sequenceNo: s.sequenceNo,
      })),
    });
  } catch (err) {
    console.error(`createTest failed — cleaning up the now-orphaned pattern ${patternId} and its ${patternSectionIdBySeq.size} section(s) before re-throwing`);
    await pool.query(`delete from catalog.pattern_section where pattern_id = $1`, [patternId]);
    await pool.query(`delete from catalog.exam_pattern where pattern_id = $1`, [patternId]);
    throw err;
  }
  console.log(`assess.test: ${createdTest.testId} (${createdTest.testCode}), status=${createdTest.testStatus}`);

  const ingestResult = await ingestFixedPaper({
    testId: createdTest.testId,
    sections: createdTest.sections.map((cs, i) => ({
      testSectionId: cs.testSectionId,
      questionIds: resolvedSections[i].questionIds,
    })),
  });
  console.log(`assess.test_question: inserted ${ingestResult.inserted} rows`);

  console.log(
    `\ncommitted. test_id = ${createdTest.testId}, test_code = ${createdTest.testCode}, test_status = ${createdTest.testStatus} (draft — publish separately through review, per convention).`
  );
  await pool.end();
}

main().catch((err) => {
  console.error("compose-fixed-paper-i17 failed:", err);
  process.exitCode = 1;
});
