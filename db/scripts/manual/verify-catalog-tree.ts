import { pool } from "../../shared/pool.js";

// One-off sanity check for Phase D's new GET /api/catalog/tree endpoint
// (backend/src/controllers/catalogTreeController.ts) — calls the controller
// function directly (same pattern as questionController.test.ts) against the
// live DB and prints the shape + a few counts to eyeball.

async function main() {
  const { getCatalogTree } = await import("../../../backend/src/controllers/catalogTreeController.js");
  const req = {} as any;
  const result = await new Promise<any>((resolve, reject) => {
    const res = { json: (body: any) => resolve(body) } as any;
    getCatalogTree(req, res, reject as any).catch(reject);
  });

  console.log(`exam: ${result.data.examCode} (${result.data.examId})`);
  for (const s of result.data.subjects) {
    console.log(`${s.subjectCode}: ${s.units.length} units, ${s.publishedQuestionCount} published questions`);
    for (const u of s.units.slice(0, 2)) {
      console.log(`  - ${u.tagCode} "${u.title}" nodeId=${u.nodeId} count=${u.publishedQuestionCount}`);
    }
  }
  const totalUnits = result.data.subjects.reduce((sum: number, s: any) => sum + s.units.length, 0);
  const totalQuestions = result.data.subjects.reduce((sum: number, s: any) => sum + s.publishedQuestionCount, 0);
  console.log(`\ntotals: ${result.data.subjects.length} subjects, ${totalUnits} units, ${totalQuestions} published questions`);

  await pool.end();
}

main().catch((err) => {
  console.error("verify-catalog-tree failed:", err);
  process.exitCode = 1;
});
