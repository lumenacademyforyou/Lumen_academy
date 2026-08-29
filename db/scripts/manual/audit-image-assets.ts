import { pool } from "../../shared/pool.js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";
import { dbConfig } from "../../config/env.js";
import { resolveAssetUrl } from "../../content/asset-resolver.js";

// docs/neet-tool-fix-prompt.md Task 3b, Step 1 — the read-only audit report.
// One row per asset ("OK"/"ORPHAN"/"SHARED"/"SUSPECT" possible), plus one
// row per question that has has_image=true but no matching asset row
// ("DANGLING"). Prints counts per category and does not write anything —
// per the task's own instruction ("do not proceed until these numbers are
// reviewed"), renaming/relinking (Steps 2-5) only happens in a later pass,
// after a human has looked at these numbers.
//
// Note on "SUSPECT" (filename encodes a question id/serial that disagrees
// with referenced_by_question_id): this codebase's real asset filenames are
// topic-abbreviation + serial (e.g. CHE_SOMBAS_DIAG_0001.png), not
// question-id-based, so there is no question id embedded in the filename to
// disagree with by construction. That's not the same as "no crossed-wire
// risk" (a topic-serial name can still be pointed at the wrong question_id
// without the filename itself ever contradicting anything) — it just means
// this category can't be detected by filename pattern-matching for this
// data, and the human visual spot-check (Step 2 / Task 3e) is the only real
// check for that case, not this script.

interface AssetRow {
  asset_id: string;
  question_id: string | null;
  option_id: string | null;
  target_role: string;
  storage_uri: string;
  question_uid: string | null;
  lifecycle_status: string | null;
}

async function main() {
  const bucket = dbConfig.objectStorageBucket!;
  const admin = getSupabaseAdmin();

  const assetsRes = await pool.query<AssetRow>(
    `select a.asset_id, a.question_id, a.option_id, a.target_role, a.storage_uri,
            q.question_uid, q.lifecycle_status
       from content.asset a
       left join content.question q on q.question_id = a.question_id
      order by q.question_uid, a.target_role, a.display_order`
  );

  const counts = { OK: 0, ORPHAN: 0, SHARED: 0, SUSPECT: 0, DANGLING: 0 };
  const rows: { asset_id: string; question_uid: string | null; slot: string; status: string; note: string }[] = [];

  // SHARED detection: same storage_uri referenced by more than one question_id.
  const byUri = new Map<string, Set<string>>();
  for (const r of assetsRes.rows) {
    if (!r.question_id) continue;
    const set = byUri.get(r.storage_uri) ?? new Set<string>();
    set.add(r.question_id);
    byUri.set(r.storage_uri, set);
  }

  for (const row of assetsRes.rows) {
    const slot = row.option_id ? `option(${row.option_id})` : row.target_role;

    if (!row.question_id || !row.question_uid) {
      counts.ORPHAN++;
      rows.push({ asset_id: row.asset_id, question_uid: null, slot, status: "ORPHAN", note: "no question_id / no matching content.question row" });
      continue;
    }

    const dir = row.storage_uri.substring(0, row.storage_uri.lastIndexOf("/"));
    const fileName = row.storage_uri.substring(row.storage_uri.lastIndexOf("/") + 1);
    const { data: listing, error: listError } = await admin.storage.from(bucket).list(dir);
    const fileExists = !listError && listing?.some((f) => f.name === fileName);
    if (!fileExists) {
      counts.ORPHAN++;
      rows.push({ asset_id: row.asset_id, question_uid: row.question_uid, slot, status: "ORPHAN", note: `references a question but the storage object is missing: ${row.storage_uri}` });
      continue;
    }

    const sharedWith = byUri.get(row.storage_uri);
    if (sharedWith && sharedWith.size > 1) {
      counts.SHARED++;
      rows.push({ asset_id: row.asset_id, question_uid: row.question_uid, slot, status: "SHARED", note: `same file referenced by ${sharedWith.size} question_ids — flagged, not auto-fixed` });
      continue;
    }

    // SUSPECT: filename encodes a serial/uid that disagrees with the
    // referencing question. Real filenames here carry no question
    // identifier at all (see file header) — nothing to compare, so this
    // never fires for this dataset's naming convention.
    const uidInFilename = fileName.match(/LMN-[A-Z]+-[A-Z0-9]+-\d+|LEGACY-\d+/i)?.[0];
    if (uidInFilename && uidInFilename.toUpperCase() !== row.question_uid.toUpperCase()) {
      counts.SUSPECT++;
      rows.push({ asset_id: row.asset_id, question_uid: row.question_uid, slot, status: "SUSPECT", note: `filename encodes ${uidInFilename}, asset is linked to ${row.question_uid}` });
      continue;
    }

    counts.OK++;
    rows.push({ asset_id: row.asset_id, question_uid: row.question_uid, slot, status: "OK", note: resolveAssetUrl(row.storage_uri) });
  }

  // DANGLING: questions that claim has_image=true but have zero content.asset rows.
  const danglingRes = await pool.query<{ question_id: string; question_uid: string }>(
    `select q.question_id, q.question_uid
       from content.question q
      where q.has_image = true
        and not exists (select 1 from content.asset a where a.question_id = q.question_id)`
  );
  for (const d of danglingRes.rows) {
    counts.DANGLING++;
    rows.push({ asset_id: "(none)", question_uid: d.question_uid, slot: "?", status: "DANGLING", note: "has_image=true but no content.asset row exists for this question" });
  }

  console.log(`${assetsRes.rowCount} content.asset row(s), ${danglingRes.rowCount} DANGLING question(s) (has_image=true, no asset row)\n`);
  for (const r of rows) {
    console.log(`${r.status.padEnd(8)} ${(r.question_uid ?? "(none)").padEnd(28)} ${r.slot.padEnd(14)} ${r.asset_id.slice(0, 8)}  ${r.note}`);
  }

  console.log("\n--- counts per category ---");
  for (const [k, v] of Object.entries(counts)) console.log(`${k.padEnd(10)} ${v}`);
  console.log(`\nTotal asset rows examined: ${assetsRes.rowCount}. Total flagged for review (DANGLING+SUSPECT+unreviewed): ${counts.DANGLING + counts.SUSPECT}.`);

  await pool.end();
}

main().catch((err) => {
  console.error("audit-image-assets failed:", err);
  process.exitCode = 1;
});
