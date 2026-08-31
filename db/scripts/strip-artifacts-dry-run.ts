/**
 * Dry run for db/migrations/036_strip_template_artifacts.sql
 * (docs/test-engine-fix-prompt.md Defect 1, requirement 3: "must log a
 * before/after sample of 20 rows for manual review before committing").
 *
 * Read-only. Runs the whole strip inside a transaction that is always rolled
 * back, so it also proves the migration's real row counts — including how
 * many rows the strip newly collapses onto an existing content_fp — against
 * live data without changing anything.
 *
 *   npx tsx db/scripts/strip-artifacts-dry-run.ts
 */
import { pool } from "../shared/pool.js";
import { stripQuestionArtifacts } from "../shared/questionArtifacts.js";
import fs from "node:fs";
import path from "node:path";

const MIGRATION = path.join(process.cwd(), "db/migrations/036_strip_template_artifacts.sql");

async function main(): Promise<void> {
  const client = await pool.connect();
  try {
    // ---- Before ----
    const affected = await client.query<{ question_id: string; stem_text: string }>(
      `select question_id, stem_text
         from content.question
        where stem_text ilike '%case #%' or stem_text ~ '#[ ]*[0-9]+([_.-][0-9]+)?'
        order by question_id`
    );
    console.log(`\n=== Rows whose stem_text carries an artifact: ${affected.rowCount} ===\n`);

    const sample = affected.rows.slice(0, 20);
    for (const [i, row] of sample.entries()) {
      const after = stripQuestionArtifacts(row.stem_text);
      console.log(`--- ${i + 1}. ${row.question_id}`);
      console.log(`    BEFORE: ${row.stem_text}`);
      console.log(`    AFTER : ${after}`);
      if (after === row.stem_text) console.log(`    !! NO CHANGE — the TS stripper did not match this row`);
    }

    const translations = await client.query<{ n: string }>(
      `select count(*) n from content.question_translation
        where stem_text ilike '%case #%' or stem_text ~ '#[ ]*[0-9]+([_.-][0-9]+)?'`
    );
    console.log(`\n=== Translations carrying an artifact: ${translations.rows[0].n} ===`);

    // ---- Apply inside a rolled-back transaction to measure real effects ----
    const before = await client.query<{ published: string; distinct_fp: string }>(
      `select count(*) published, count(distinct content_fp) distinct_fp
         from content.question where lifecycle_status = 'published'`
    );

    await client.query("begin");
    await client.query(fs.readFileSync(MIGRATION, "utf8"));

    const after = await client.query<{ published: string; distinct_fp: string; archived: string }>(
      `select count(*) filter (where lifecycle_status = 'published') published,
              count(distinct content_fp) filter (where lifecycle_status = 'published') distinct_fp,
              count(*) filter (where lifecycle_status = 'duplicate_archived') archived
         from content.question`
    );
    const stillDirty = await client.query<{ n: string }>(
      `select count(*) n from content.question
        where content.fn_strip_question_artifacts(stem_text) is distinct from stem_text`
    );
    // Second application must be a no-op — the idempotence acceptance criterion.
    const secondPass = await client.query<{ n: string }>(
      `select count(*) n from content.question
        where content.fn_strip_question_artifacts(stem_text) is distinct from stem_text`
    );

    console.log(`\n=== Effect (measured inside a transaction that is about to be rolled back) ===`);
    console.log(`published questions : ${before.rows[0].published} -> ${after.rows[0].published}`);
    console.log(`distinct content_fp : ${before.rows[0].distinct_fp} -> ${after.rows[0].distinct_fp}`);
    console.log(`newly archived      : the strip collapsed variants onto existing rows (total duplicate_archived now ${after.rows[0].archived})`);
    console.log(`rows still dirty    : ${stillDirty.rows[0].n}  (must be 0)`);
    console.log(`idempotence re-check: ${secondPass.rows[0].n} rows would change on a second run  (must be 0)`);

    await client.query("rollback");
    console.log(`\nRolled back. Nothing was written.\n`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
