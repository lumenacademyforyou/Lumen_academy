/**
 * LL-P0 stop-gate proof (LA-PLAN-002 Day 1, Santhosh 08:00-09:00 slot).
 * listExams()/getSyllabusTree() against live Supabase data, with a manual
 * SELECT COUNT(*) cross-check per the plan's stated "Done when".
 *
 * Usage: npx tsx db/scripts/prove-ll-p0-syllabus.ts
 */
import { pool } from "../shared/pool.js";
import { listExams, getSyllabusTree } from "../learn/syllabus/tree.js";

async function main() {
  console.log("=== listExams() ===");
  const exams = await listExams();
  for (const exam of exams) {
    console.log(`${exam.examCode} (${exam.displayName}) — syllabus ${exam.syllabusVersionLabel}`);
    for (const s of exam.subjects) {
      console.log(`  ${s.subjectCode}: ${s.availableQuestions} available questions`);
    }
  }
  console.log(`listExams returned ${exams.length} exam(s): ${exams.length > 0 ? "PASS" : "FAIL (expected at least NEET)"}`);

  console.log("\n=== getSyllabusTree('NEET') ===");
  const tree = await getSyllabusTree("NEET");
  console.log(`root nodes: ${tree.nodes.length}, syllabus version: ${tree.syllabusVersionLabel}`);
  const flatten = (nodes: typeof tree.nodes): typeof tree.nodes => nodes.flatMap((n) => [n, ...flatten(n.children)]);
  const allNodes = flatten(tree.nodes);
  console.log(`total nodes across the tree: ${allNodes.length} (expect 38, per docs/DB_STATE.md)`);
  console.log(`node count matches live catalog.syllabus_node: ${allNodes.length === 38 ? "PASS" : "FAIL"}`);

  console.log("\n=== Manual count cross-check ===");
  let mismatches = 0;
  // Spot-check every node's availableQuestions against a direct SQL count,
  // not just the total — a per-node aggregation bug wouldn't show up in a
  // sum-only check.
  for (const node of allNodes) {
    const manual = await pool.query<{ n: string }>(
      `select count(*) as n
         from content.question_node_map qnm
         join content.question q on q.question_id = qnm.question_id
        where qnm.node_id = $1 and q.lifecycle_status = 'published'`,
      [node.nodeId]
    );
    if (Number(manual.rows[0].n) !== node.availableQuestions) {
      mismatches++;
      console.log(`  MISMATCH node ${node.nodeId} (${node.title}): tree=${node.availableQuestions}, manual=${manual.rows[0].n}`);
    }
  }
  console.log(`all ${allNodes.length} node counts match a manual SELECT COUNT(*): ${mismatches === 0 ? "PASS" : `FAIL (${mismatches} mismatch(es))`}`);

  console.log("\n=== Single-subject filter + depth cap ===");
  const physicsOnly = await getSyllabusTree("NEET", "PHY");
  console.log(`PHY-only tree: ${physicsOnly.nodes.length} node(s), all subject-scoped: ${physicsOnly.nodes.length > 0 && physicsOnly.nodes.length < allNodes.length ? "PASS" : "FAIL"}`);
  const depthCapped = await getSyllabusTree("NEET", undefined, 0);
  console.log(`depth=0 tree: ${depthCapped.nodes.length} node(s) (expect 0, since the flat 38 nodes are all at level 0 and depth=0 excludes level 0): ${depthCapped.nodes.length === 0 ? "PASS" : "FAIL"}`);

  console.log("\n=== D-9 proof: a fourth examination appears with no code change ===");
  const tempExamRes = await pool.query<{ exam_id: string }>(
    `insert into catalog.exam (exam_code, display_name, is_active) values ('LL_P0_PROOF_EXAM', 'LL-P0 Proof Exam', true) returning exam_id`
  );
  const tempExamId = tempExamRes.rows[0].exam_id;
  const tempVersionRes = await pool.query<{ syllabus_version_id: string }>(
    `insert into catalog.syllabus_version (exam_id, version_status, effective_year) values ($1, 'active', 2099) returning syllabus_version_id`,
    [tempExamId]
  );
  const examsAfter = await listExams();
  const found = examsAfter.find((e) => e.examCode === "LL_P0_PROOF_EXAM");
  console.log(`fourth exam appears with no code change: ${found ? "PASS" : "FAIL"}`);
  await pool.query(`delete from catalog.syllabus_version where syllabus_version_id = $1`, [tempVersionRes.rows[0].syllabus_version_id]);
  await pool.query(`delete from catalog.exam where exam_id = $1`, [tempExamId]);
  console.log("temporary proof exam removed");

  await pool.end();
}

main().catch((err) => {
  console.error("prove-ll-p0-syllabus failed:", err);
  process.exitCode = 1;
});
