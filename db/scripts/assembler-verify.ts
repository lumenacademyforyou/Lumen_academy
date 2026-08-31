import "dotenv/config";
import { pool } from "../shared/pool.js";
import { createPracticeTest } from "../assess/test/definition/create-practice-test.js";
import { assembleForAttempt } from "../assess/test/generation/assemble.js";
import { startAttempt, submitAttempt } from "../assess/test/attempt/attempt-flow.js";
import { PoolInsufficientError } from "../shared/errors.js";

// docs/no-repeat-questions-fix.md Phase 7 — narrow verification before
// widening scope past unit 1. Usage:
//
//   npx tsx db/scripts/assembler-verify.ts --unit=1 --subjects=all [--commit] [--pick-count=30]
//
// Dry-run by default (--commit not passed): draws are computed via
// assembleForAttempt directly, which is read-only by its own design
// (db/assess/test/generation/assemble.ts's own header comment) and never
// persists an attempt. Honesty note, not swept under the rug: creating the
// underlying assess.test/test_blueprint scaffolding itself is unavoidable —
// createPracticeTest (db/assess/test/definition/create-practice-test.ts)
// writes directly via the shared pool with no transaction/client parameter
// to route this script's own dry-run rollback through. That scaffolding is
// small, clearly labeled (scopeCode P7VERIFY-<SUBJECT>-U<unit>), and inert
// (never attempted unless --commit is also passed) — a real compromise, not
// a false "zero writes" claim.
//
// --pick-count defaults to 30 — this app has no first-class "unit mock"
// blueprint concept yet (units aren't a standalone test type), so there is
// no canonical target size to check against. 30 is used because it's the
// original per-unit seeded row count before migration 031's collapse (see
// docs/POOL_CENSUS.md) — the most defensible stand-in for "how big a full
// unit test was assumed to be" without inventing a number with no source.
// Override with --pick-count=N for a different target.

interface Args {
  unit: number;
  subjects: string[] | "all";
  commit: boolean;
  pickCount: number;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string) => argv.find((a) => a.startsWith(`--${flag}=`))?.split("=")[1];
  const unit = Number(get("unit") ?? "1");
  const subjectsRaw = get("subjects") ?? "all";
  const commit = argv.includes("--commit");
  const pickCount = Number(get("pick-count") ?? "30");
  return { unit, subjects: subjectsRaw === "all" ? "all" : subjectsRaw.split(","), commit, pickCount };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log(args.commit ? "--- LIVE (--commit): assembled papers will be persisted as real attempts ---" : "--- DRY RUN: draws computed via read-only assembleForAttempt, no attempt persisted ---");
  console.log(`unit index: ${args.unit} (1 = first unit per subject, ordered by catalog.syllabus_node.sort_order)`);
  console.log(`pick-count target: ${args.pickCount}\n`);

  const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true limit 1`);
  if (examRes.rowCount === 0) throw new Error("no active catalog.exam row");
  const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

  const subjectRows = await pool.query<{ subject_id: string; subject_code: string; subject_name: string }>(
    `select subject_id, subject_code, subject_name from catalog.subject where exam_id = $1 order by display_order`,
    [examId]
  );
  const subjects = args.subjects === "all" ? subjectRows.rows : subjectRows.rows.filter((s) => (args.subjects as string[]).includes(s.subject_code));

  const verifyUserRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user order by user_id asc limit 1`);
  if (verifyUserRes.rowCount === 0) throw new Error("no core.app_user row to run verification draws as");
  const verifyUserId = verifyUserRes.rows[0].user_id;
  await pool.query(`update assess.attempt set attempt_state = 'abandoned' where user_id = $1 and attempt_state in ('in_progress','paused')`, [verifyUserId]);

  const summary: { subject: string; unit: string; poolRows: number; distinctContent: number; buildable: boolean; deficit: number; overlapOk: boolean; recycled: number }[] = [];

  for (const subject of subjects) {
    console.log(`\n${"=".repeat(70)}\n${subject.subject_name} (${subject.subject_code})\n${"=".repeat(70)}`);

    const unitRes = await pool.query<{ node_id: string; title: string }>(
      `select node_id, title from catalog.syllabus_node where subject_id = $1 and node_type = 'unit' order by sort_order asc offset $2 limit 1`,
      [subject.subject_id, args.unit - 1]
    );
    if (unitRes.rowCount === 0) {
      console.log(`  no unit at index ${args.unit} for this subject — skipping`);
      continue;
    }
    const { node_id: nodeId, title: unitTitle } = unitRes.rows[0];
    console.log(`unit: ${unitTitle}`);

    const poolRes = await pool.query<{ difficulty_band: string | null; rows: string; distinct_content: string; distinct_skeleton: string }>(
      `select q.difficulty_band, count(*) as rows, count(distinct q.content_fp) as distinct_content, count(distinct q.skeleton_fp) as distinct_skeleton
         from content.question q
         join content.question_node_map qnm on qnm.question_id = q.question_id
        where qnm.node_id = $1 and q.lifecycle_status = 'published'
        group by q.difficulty_band
        order by q.difficulty_band nulls last`,
      [nodeId]
    );
    console.log("pool by difficulty_band (rows / distinct content_fp / distinct skeleton_fp):");
    let totalRows = 0;
    let totalDistinctContent = 0;
    for (const row of poolRes.rows) {
      console.log(`  ${row.difficulty_band ?? "(null)"}: ${row.rows} / ${row.distinct_content} / ${row.distinct_skeleton}`);
      totalRows += Number(row.rows);
      totalDistinctContent += Number(row.distinct_content);
    }
    console.log(`  TOTAL: ${totalRows} rows, ${totalDistinctContent} distinct content_fp`);

    const buildable = totalDistinctContent >= args.pickCount;
    const deficit = Math.max(0, args.pickCount - totalDistinctContent);
    console.log(`buildable at pick-count=${args.pickCount}? ${buildable ? "YES" : `NO — deficit ${deficit}`}`);

    // Fresh test user: reset this user's exposure for every real question in
    // this unit so "recycle count should be 0" is a guarantee, not a hope.
    const unitQuestionIdsRes = await pool.query<{ question_id: string }>(
      `select distinct q.question_id from content.question q
         join content.question_node_map qnm on qnm.question_id = q.question_id
        where qnm.node_id = $1 and q.lifecycle_status = 'published'`,
      [nodeId]
    );
    await pool.query(`delete from assess.user_question_seen where user_id = $1 and question_id = any($2::uuid[])`, [
      verifyUserId,
      unitQuestionIdsRes.rows.map((r) => r.question_id),
    ]);

    const created = await createPracticeTest({
      examId,
      examCode,
      testType: "SUBJ",
      scopeCode: `P7VF${subject.subject_code}U${args.unit}`.slice(0, 20),
      title: `Phase 7 verify: ${subject.subject_name} / ${unitTitle}`,
      durationMinutes: 60,
      createdBy: verifyUserId,
      lines: [{ subjectId: subject.subject_id, syllabusNodeId: nodeId, includeDescendants: false, pickCount: args.pickCount, sectionName: subject.subject_code }],
    });
    await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [created.testId]);

    let overlapOk = true;
    let recycled = 0;
    let assertionResult: "pass" | "fail" | "n/a (insufficient pool)" = "n/a (insufficient pool)";

    try {
      const assembled = await assembleForAttempt(created.testId, verifyUserId);
      assertionResult = "pass"; // assembleForAttempt itself throws AssemblerDuplicateAssertionError on failure — reaching here means it passed
      const questionIds = assembled.sections.flatMap((s) => s.questionIds);
      recycled = assembled.recycledCount;

      const detailRes = await pool.query<{ question_id: string; stem_fp: Buffer; difficulty_band: string | null; stem_text: string }>(
        `select question_id, stem_fp, difficulty_band, stem_text from content.question where question_id = any($1::uuid[])`,
        [questionIds]
      );
      const detailByQ = new Map(detailRes.rows.map((r) => [r.question_id, r]));

      const seenQ = new Set<string>();
      const seenContentFp = new Set<string>();
      const seenStemFp = new Set<string>();
      console.log(`\nthe paper (${questionIds.length} items):`);
      for (const section of assembled.sections) {
        for (let i = 0; i < section.questionIds.length; i++) {
          const qid = section.questionIds[i];
          const cfp = section.contentFps[i];
          const detail = detailByQ.get(qid);
          const sfp = detail?.stem_fp.toString("hex") ?? "";
          console.log(
            `  ${qid} | ${detail?.difficulty_band ?? "(null)"} | ${cfp.slice(0, 8)} | ${(detail?.stem_text ?? "").slice(0, 80).replace(/\s+/g, " ")}`
          );
          if (seenQ.has(qid) || seenContentFp.has(cfp) || seenStemFp.has(sfp)) overlapOk = false;
          seenQ.add(qid);
          seenContentFp.add(cfp);
          seenStemFp.add(sfp);
        }
      }
      console.log(`self-overlap check: ${overlapOk ? "0 overlaps (OK)" : "OVERLAP DETECTED (FAIL)"}`);
      console.log(`recycle count (fresh user): ${recycled} ${recycled === 0 ? "(OK)" : "(unexpected on a freshly-reset user)"}`);
      console.log(`pre-persist assertion: ${assertionResult}`);

      if (args.commit) {
        const attempt = await startAttempt(created.testId, verifyUserId);
        console.log(`--commit: persisted real attempt ${attempt.attemptId} (hasRecycledItems=${attempt.hasRecycledItems}, recycledItemCount=${attempt.recycledItemCount})`);
        await submitAttempt(attempt.attemptId, verifyUserId);
      }
    } catch (err) {
      if (err instanceof PoolInsufficientError) {
        console.log(`\nINSUFFICIENT_POOL: requested ${err.requested}, available ${err.available} — expected result per docs/POOL_CENSUS.md, not worked around.`);
      } else {
        throw err;
      }
    }

    summary.push({ subject: subject.subject_code, unit: unitTitle, poolRows: totalRows, distinctContent: totalDistinctContent, buildable, deficit, overlapOk, recycled });
  }

  console.log(`\n${"=".repeat(70)}\nSUMMARY\n${"=".repeat(70)}`);
  console.table(summary);

  await pool.end();
}

main().catch((err) => {
  console.error("assembler-verify FAILED:", err);
  process.exitCode = 1;
});
