import { pool } from "../../shared/pool.js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";
import { dbConfig } from "../../config/env.js";
import { resolveAssetUrl } from "../../content/asset-resolver.js";

// One-off verification for Phase B3 (LA-APP-COMPLETION-001): for every
// content.question with an attached asset, confirm the content.asset row,
// the Supabase Storage object, the question's has_image flag, and a
// resolvable public URL all agree. Read-only except for the has_image
// backfill, which is applied only if --fix is passed.

async function main() {
  const fix = process.argv.includes("--fix");
  const bucket = dbConfig.objectStorageBucket!;
  const admin = getSupabaseAdmin();

  const assetsRes = await pool.query<{
    asset_id: string;
    question_id: string | null;
    storage_uri: string;
    question_uid: string | null;
    lifecycle_status: string | null;
    has_image: boolean | null;
  }>(
    `select a.asset_id, a.question_id, a.storage_uri, q.question_uid, q.lifecycle_status, q.has_image
       from content.asset a
       left join content.question q on q.question_id = a.question_id
      order by q.question_uid`
  );

  console.log(`${assetsRes.rowCount} content.asset row(s) found\n`);

  let orphanQuestion = 0;
  let missingObject = 0;
  let staleHasImageFlag: string[] = [];

  for (const row of assetsRes.rows) {
    if (!row.question_id) {
      console.log(`ORPHAN (no question_id): asset ${row.asset_id} storage_uri=${row.storage_uri}`);
      orphanQuestion++;
      continue;
    }
    if (!row.question_uid) {
      console.log(`ORPHAN (question_id ${row.question_id} has no matching content.question row): asset ${row.asset_id}`);
      orphanQuestion++;
      continue;
    }

    // Confirm the object exists in Storage (list the parent "directory" and
    // check the filename is in it — the JS client has no direct HEAD/stat).
    const dir = row.storage_uri.substring(0, row.storage_uri.lastIndexOf("/"));
    const fileName = row.storage_uri.substring(row.storage_uri.lastIndexOf("/") + 1);
    const { data: listing, error: listError } = await admin.storage.from(bucket).list(dir);
    const exists = !listError && listing?.some((f) => f.name === fileName);
    const url = resolveAssetUrl(row.storage_uri);

    if (!exists) {
      console.log(`MISSING STORAGE OBJECT: ${row.question_uid} (${row.lifecycle_status}) -> ${row.storage_uri}`);
      missingObject++;
    } else {
      console.log(`ok: ${row.question_uid} (${row.lifecycle_status}) has_image=${row.has_image} -> ${url}`);
    }

    if (row.has_image === false) {
      staleHasImageFlag.push(row.question_id);
    }
  }

  console.log(`\n${orphanQuestion} orphaned asset row(s), ${missingObject} missing storage object(s)`);
  console.log(`${staleHasImageFlag.length} question(s) have an asset but has_image=false`);

  if (staleHasImageFlag.length > 0 && fix) {
    const res = await pool.query(`update content.question set has_image = true where question_id = any($1)`, [staleHasImageFlag]);
    console.log(`--fix: set has_image = true on ${res.rowCount} question(s)`);
  } else if (staleHasImageFlag.length > 0) {
    console.log("re-run with --fix to correct the has_image flag on these questions");
  }

  await pool.end();
}

main().catch((err) => {
  console.error("verify-image-assets failed:", err);
  process.exitCode = 1;
});
