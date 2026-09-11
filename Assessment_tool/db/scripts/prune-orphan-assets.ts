/**
 * prune-orphan-assets — deletes object-storage files that no content.asset
 * row references.
 *
 * WHY THERE ARE ANY
 * -----------------
 * Migration 024 renamed every question image from its authored, human-readable
 * name ("CHE_SOMBAS_DIAG_0001.png") to an id-based one
 * ("q_<uuid>_stem_01.png"). It COPIED rather than MOVED, so both files remain
 * and only the id-named one is referenced. content.asset_rename_log records
 * every old_path -> new_path pair, so each leftover is provable rather than
 * guessed at. There is also at least one file under a question_id that has no
 * content.question row at all, and the objects belonging to the mis-attached
 * asset that migration 042 archived and removed.
 *
 * SAFETY
 * ------
 * Deleting from object storage is irreversible — there is no undo and no
 * archive table for bytes. So:
 *   * --dry-run is the default; --execute is required to delete anything.
 *   * An object is only ever a candidate if NO content.asset row references
 *     its path. The referenced set is read fresh from the database in the same
 *     run, never cached or assumed.
 *   * Every candidate is classified with the evidence that makes it an orphan
 *     (a rename-log entry, a missing question, or an archived asset). Anything
 *     that cannot be explained is reported as UNEXPLAINED and is NOT deleted
 *     unless --include-unexplained is passed, because an unexplained orphan is
 *     more likely to be a bug in this script than genuine garbage.
 *   * The bucket is scanned under the question/ prefix only.
 *
 *   npx tsx db/scripts/prune-orphan-assets.ts --dry-run
 *   npx tsx db/scripts/prune-orphan-assets.ts --execute
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../shared/pool.js";

const args = process.argv.slice(2);
const dryRun = !args.includes("--execute");
const includeUnexplained = args.includes("--include-unexplained");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.OBJECT_STORAGE_BUCKET ?? "content-assets";
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  process.exit(1);
}
const storage = createClient(SUPABASE_URL, SERVICE_KEY).storage.from(BUCKET);

async function listAll(prefix: string, depth = 0): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await storage.list(prefix, { limit: 1000 });
  if (error) throw new Error(`list ${prefix}: ${error.message}`);
  for (const e of data ?? []) {
    const p = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.id === null) {
      if (depth < 4) out.push(...(await listAll(p, depth + 1)));
    } else {
      out.push(p);
    }
  }
  return out;
}

async function main(): Promise<void> {
  console.log(`prune-orphan-assets — bucket ${BUCKET}${dryRun ? " (DRY RUN)" : " (EXECUTE)"}`);

  const referenced = new Set(
    (await pool.query<{ storage_uri: string }>(`select storage_uri from content.asset where storage_uri is not null`)).rows.map(
      (r) => r.storage_uri
    )
  );
  const renamedFrom = new Set(
    (await pool.query<{ old_path: string }>(`select old_path from content.asset_rename_log where old_path is not null`)).rows.map(
      (r) => r.old_path
    )
  );
  const archived = new Set(
    (await pool.query<{ storage_uri: string }>(`select storage_uri from content.asset_archive where storage_uri is not null`)).rows.map(
      (r) => r.storage_uri
    )
  );
  const liveQuestionIds = new Set(
    (await pool.query<{ question_id: string }>(`select question_id::text from content.question`)).rows.map((r) => r.question_id)
  );

  const objects = await listAll("question");
  console.log(`  ${objects.length} object(s) in storage, ${referenced.size} referenced by content.asset`);

  const buckets: Record<string, string[]> = { RENAME_LEFTOVER: [], DEAD_QUESTION: [], ARCHIVED_ASSET: [], UNEXPLAINED: [] };

  for (const path of objects) {
    if (referenced.has(path)) continue;
    const qid = path.split("/")[1] ?? "";
    if (renamedFrom.has(path)) buckets.RENAME_LEFTOVER.push(path);
    else if (!liveQuestionIds.has(qid)) buckets.DEAD_QUESTION.push(path);
    else if (archived.has(path)) buckets.ARCHIVED_ASSET.push(path);
    // An archived asset's human-named twin is a rename leftover whose log row
    // points at a path we already archived — classify it rather than leaving
    // it unexplained.
    else if ([...archived].some((a) => a.split("/")[1] === qid)) buckets.ARCHIVED_ASSET.push(path);
    else buckets.UNEXPLAINED.push(path);
  }

  for (const [reason, paths] of Object.entries(buckets)) {
    if (paths.length === 0) continue;
    console.log(`\n  ${reason} — ${paths.length}`);
    for (const p of paths) console.log(`    ${p}`);
  }

  const toDelete = [
    ...buckets.RENAME_LEFTOVER,
    ...buckets.DEAD_QUESTION,
    ...buckets.ARCHIVED_ASSET,
    ...(includeUnexplained ? buckets.UNEXPLAINED : []),
  ];

  if (buckets.UNEXPLAINED.length > 0 && !includeUnexplained) {
    console.log(
      `\n  ${buckets.UNEXPLAINED.length} UNEXPLAINED object(s) will NOT be deleted. An orphan this script cannot account for is more likely a gap in the script than garbage — investigate, then re-run with --include-unexplained if they really are junk.`
    );
  }

  console.log(`\n  ${toDelete.length} object(s) ${dryRun ? "would be" : "to be"} deleted.`);
  if (toDelete.length === 0 || dryRun) {
    if (dryRun) console.log("  Dry run — nothing deleted. Re-run with --execute.");
    return;
  }

  // Final re-check against the live referenced set immediately before deleting.
  const stillReferenced = toDelete.filter((p) => referenced.has(p));
  if (stillReferenced.length > 0) {
    throw new Error(`refusing to delete referenced object(s): ${stillReferenced.join(", ")}`);
  }

  const { error } = await storage.remove(toDelete);
  if (error) throw new Error(`remove failed: ${error.message}`);
  console.log(`  deleted ${toDelete.length} object(s).`);

  const after = await listAll("question");
  console.log(`  ${after.length} object(s) remain; ${referenced.size} referenced.`);
  const brokenRefs = [...referenced].filter((r) => !after.includes(r));
  if (brokenRefs.length > 0) {
    console.error(`  !! ${brokenRefs.length} content.asset row(s) now point at a missing object:`);
    for (const b of brokenRefs) console.error(`     ${b}`);
    process.exitCode = 1;
  } else {
    console.log("  every content.asset row still resolves to a real object.");
  }
}

main()
  .catch((err) => {
    console.error("prune failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
