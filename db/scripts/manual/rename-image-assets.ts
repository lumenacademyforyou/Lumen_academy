import path from "node:path";
import { pool } from "../../shared/pool.js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";
import { dbConfig } from "../../config/env.js";
import { resolveAssetUrl } from "../../content/asset-resolver.js";

// docs/neet-tool-fix-prompt.md Task 3b, Step 3-4 — rename the confirmed
// (already-audited-clean, per audit-image-assets.ts's live run: 15/15 OK,
// 0 ORPHAN/SHARED/SUSPECT/DANGLING) assets to the canonical scheme:
//   q_<question_id>_stem_<nn>.<ext>
//   q_<question_id>_opt_<A|B|C|D>_<nn>.<ext>
// User-approved to run against the live DB + Storage (asked first — this
// mutates production Storage objects and content.asset rows).
//
// Step 4 discipline: COPY (not move) to the new path first, so the old
// object stays in Storage as a backup until 3e's verification pass
// re-confirms everything resolves under the new name — only then would a
// later, separate pass ever delete the old objects (not done by this
// script). Every rename is logged to content.asset_rename_log
// (asset_id, old_path, new_path, question_id, slot, resolution,
// reviewed_by, renamed_at) for a full audit trail, and the DB row update +
// log insert happen in one transaction per asset so a mid-run failure never
// leaves storage_uri pointing at a path nothing was ever copied to.

interface Row {
  asset_id: string;
  question_id: string;
  option_id: string | null;
  target_role: string;
  storage_uri: string;
  display_order: number;
}

function extOf(storageUri: string): string {
  return path.extname(storageUri).toLowerCase() || ".png";
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const bucket = dbConfig.objectStorageBucket!;
  const admin = getSupabaseAdmin();

  const rowsRes = await pool.query<Row>(
    `select a.asset_id, a.question_id, a.option_id, a.target_role, a.storage_uri, a.display_order
       from content.asset a
      where a.question_id is not null
      order by a.question_id, a.target_role, a.display_order`
  );

  // Assign per-(question_id, slot) sequence numbers deterministically, in
  // display_order order — matches canonicalObjectPath()'s own "count
  // existing, +1" logic in asset-resolver.ts for future uploads, so a
  // renamed batch and a freshly-ingested one land on the same convention.
  const seqBySlot = new Map<string, number>();

  const plan: { row: Row; slotTag: string; newPath: string }[] = [];
  for (const row of rowsRes.rows) {
    let slotTag: string;
    if (row.target_role === "option" && row.option_id) {
      const labelRes = await pool.query<{ option_label: string }>(`select option_label from content.question_option where option_id = $1`, [row.option_id]);
      slotTag = labelRes.rowCount ? `opt_${labelRes.rows[0].option_label}` : "opt_unknown";
    } else {
      slotTag = row.target_role;
    }
    const slotKey = `${row.question_id}::${slotTag}`;
    const nextSeq = (seqBySlot.get(slotKey) ?? 0) + 1;
    seqBySlot.set(slotKey, nextSeq);
    const nn = String(nextSeq).padStart(2, "0");
    const ext = extOf(row.storage_uri);
    const newPath = `question/${row.question_id}/q_${row.question_id}_${slotTag}_${nn}${ext}`;
    plan.push({ row, slotTag, newPath });
  }

  console.log(`${plan.length} asset(s) planned for rename${dryRun ? " (--dry-run, no writes)" : ""}:\n`);
  for (const p of plan) {
    const unchanged = p.row.storage_uri === p.newPath;
    console.log(`${p.row.asset_id.slice(0, 8)}  ${p.row.storage_uri}  ->  ${p.newPath}${unchanged ? "  (already canonical)" : ""}`);
  }

  if (dryRun) {
    await pool.end();
    return;
  }

  let renamed = 0;
  let skipped = 0;
  const failures: string[] = [];

  for (const p of plan) {
    if (p.row.storage_uri === p.newPath) {
      skipped++;
      continue;
    }

    const { error: copyError } = await admin.storage.from(bucket).copy(p.row.storage_uri, p.newPath);
    if (copyError) {
      failures.push(`${p.row.asset_id}: Storage copy failed (${p.row.storage_uri} -> ${p.newPath}): ${copyError.message}`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(`update content.asset set storage_uri = $1 where asset_id = $2`, [p.newPath, p.row.asset_id]);
      await client.query(
        `insert into content.asset_rename_log (asset_id, old_path, new_path, question_id, slot, resolution, reviewed_by)
         values ($1, $2, $3, $4, $5, 'ok', $6)`,
        [p.row.asset_id, p.row.storage_uri, p.newPath, p.row.question_id, p.slotTag, "audit-image-assets.ts: 15/15 OK, 0 flagged (Task 3b Step 1)"]
      );
      await client.query("commit");
      renamed++;
      console.log(`renamed: ${p.row.asset_id.slice(0, 8)} -> ${resolveAssetUrl(p.newPath)}`);
    } catch (e) {
      await client.query("rollback");
      failures.push(`${p.row.asset_id}: DB update/log failed after Storage copy succeeded (old object at ${p.row.storage_uri} still intact, new copy at ${p.newPath} now orphaned): ${(e as Error).message}`);
    } finally {
      client.release();
    }
  }

  console.log(`\n${renamed} renamed, ${skipped} already canonical, ${failures.length} failure(s).`);
  if (failures.length > 0) {
    console.log("FAILURES:");
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
  console.log(`\nOld objects at their pre-rename paths were intentionally left in Storage as a backup (Task 3b Step 4) — not deleted by this script.`);

  await pool.end();
}

main().catch((err) => {
  console.error("rename-image-assets failed:", err);
  process.exitCode = 1;
});
