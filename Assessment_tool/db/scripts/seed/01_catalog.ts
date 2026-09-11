import { SYLLABUS_UNITS } from "../../../frontend/src/data/syllabusData.js";
import { pool } from "../../shared/pool.js";

// STAGE 1 — seed catalog.exam, catalog.subject, catalog.syllabus_version,
// catalog.syllabus_node from database_sample/syllabusData.ts.
//
// Source shape (reported before writing this script): a FLAT list of 38
// units across 4 subjects — no chapter/topic sub-hierarchy exists in the
// source, so syllabus_node here is exactly 2 levels deep (subject ->
// unit), not 4. weightageMarks/expectedQuestions/weightagePercent are
// deferred (belong in catalog.node_weightage, which needs a real
// exam_pattern — out of Stage 1's scope). subtopics/keyFormulas/overview/
// highYieldNCERTChapter/materials have no column anywhere in the schema and
// are not migrated.
//
// Idempotent: upserts on each table's real unique constraint
// (uq_exam_exam_code, uq_subject_exam_id_subject_code,
// uq_syllabus_node_version_tag). syllabus_version has no AK (matches
// SCHEMA_SPEC.md — it never defines one), so it's select-or-insert instead.
//
// Usage: npx tsx db/scripts/seed/01_catalog.ts [--dry-run]

const DRY_RUN = process.argv.includes("--dry-run");

const EXAM_CODE = "NEET";
const SUBJECT_CODES: Record<string, { code: string; name: string; order: number }> = {
  physics: { code: "PHY", name: "Physics", order: 1 },
  chemistry: { code: "CHEM", name: "Chemistry", order: 2 },
  botany: { code: "BOT", name: "Botany", order: 3 },
  zoology: { code: "ZOO", name: "Zoology", order: 4 },
};

async function main() {
  console.log(DRY_RUN ? "--- DRY RUN: no writes will happen ---" : "--- LIVE RUN ---");

  const bySubject = new Map<string, typeof SYLLABUS_UNITS>();
  for (const unit of SYLLABUS_UNITS) {
    const list = bySubject.get(unit.subject) ?? [];
    list.push(unit);
    bySubject.set(unit.subject, list);
  }

  console.log("\nPlan:");
  console.log(`  1 exam (${EXAM_CODE})`);
  console.log(`  ${bySubject.size} subjects: ${[...bySubject.keys()].join(", ")}`);
  console.log(`  1 syllabus_version`);
  console.log(`  ${SYLLABUS_UNITS.length} syllabus_nodes (flat, one per unit)`);

  if (DRY_RUN) {
    for (const [subject, units] of bySubject) {
      console.log(`\n  ${subject} (${units.length} units): ${units.map((u) => u.id).join(", ")}`);
    }
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const examRes = await client.query<{ exam_id: string }>(
      `insert into catalog.exam (exam_code, display_name, conducting_body, supported_languages, is_active)
       values ($1, $2, $3, $4, true)
       on conflict (exam_code) do update set exam_code = excluded.exam_code
       returning exam_id`,
      [EXAM_CODE, "NEET (UG)", "National Testing Agency", JSON.stringify(["en", "ta"])]
    );
    const examId = examRes.rows[0].exam_id;
    console.log(`\nexam: ${EXAM_CODE} -> ${examId}`);

    const subjectIds = new Map<string, string>();
    for (const [key, meta] of Object.entries(SUBJECT_CODES)) {
      const res = await client.query<{ subject_id: string }>(
        `insert into catalog.subject (exam_id, subject_code, subject_name, display_order)
         values ($1, $2, $3, $4)
         on conflict (exam_id, subject_code) do update set subject_name = excluded.subject_name, display_order = excluded.display_order
         returning subject_id`,
        [examId, meta.code, meta.name, meta.order]
      );
      subjectIds.set(key, res.rows[0].subject_id);
      console.log(`subject: ${meta.name} -> ${res.rows[0].subject_id}`);
    }

    let versionRes = await client.query<{ syllabus_version_id: string }>(
      `select syllabus_version_id from catalog.syllabus_version where exam_id = $1 and board_name = $2 limit 1`,
      [examId, "NCERT"]
    );
    let syllabusVersionId: string;
    if (versionRes.rowCount && versionRes.rowCount > 0) {
      syllabusVersionId = versionRes.rows[0].syllabus_version_id;
      console.log(`syllabus_version: reused existing -> ${syllabusVersionId}`);
    } else {
      const insertVersion = await client.query<{ syllabus_version_id: string }>(
        `insert into catalog.syllabus_version (exam_id, board_name, version_status)
         values ($1, $2, $3)
         returning syllabus_version_id`,
        [examId, "NCERT", "active"]
      );
      syllabusVersionId = insertVersion.rows[0].syllabus_version_id;
      console.log(`syllabus_version: created -> ${syllabusVersionId}`);
    }

    let nodeCount = 0;
    for (const [subjectKey, units] of bySubject) {
      const subjectId = subjectIds.get(subjectKey);
      if (!subjectId) throw new Error(`no subject_id resolved for ${subjectKey}`);
      let order = 1;
      for (const unit of units) {
        await client.query(
          `insert into catalog.syllabus_node
             (syllabus_version_id, subject_id, parent_node_id, tag_code, node_type, title, class_level, depth, display_order)
           values ($1, $2, null, $3, 'unit', $4, $5, 0, $6)
           on conflict (syllabus_version_id, tag_code) do update set
             title = excluded.title,
             class_level = excluded.class_level,
             display_order = excluded.display_order`,
          [syllabusVersionId, subjectId, unit.id, unit.unitName, unit.ncertClass, order]
        );
        order++;
        nodeCount++;
      }
    }
    console.log(`syllabus_node: upserted ${nodeCount} rows`);

    await client.query("commit");
    console.log("\ncommitted.");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("01_catalog seed failed:", err);
  process.exitCode = 1;
});
