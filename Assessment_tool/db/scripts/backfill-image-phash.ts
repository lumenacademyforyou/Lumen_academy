/**
 * backfill-image-phash — Layer 1's image_phash, for question-dedup-audit-and-fix.md.
 *
 * WHY PERCEPTUAL AND NOT content.asset.checksum_sha256
 * ----------------------------------------------------
 * content.asset already carries a checksum_sha256, and it is useless for
 * deduplication: it is cryptographic, so the same diagram re-exported at a
 * different DPI, re-compressed, or saved by a different tool produces a
 * completely different digest. A perceptual hash survives all three.
 *
 * (The audit did find one pair the crypto hash caught — two questions sharing
 * checksum 1bb672cfb0f8 — but that is the easy case. It is the near-identical
 * re-export that a text-only or crypto-only identity is structurally blind to.)
 *
 * ALGORITHM: dHash, 64-bit. Greyscale, resize to 9x8, then emit one bit per
 * horizontal adjacent-pixel comparison (8 rows x 8 comparisons). Robust to
 * scale, compression and small brightness shifts; sensitive to actual
 * structural change. Stored as 8 bytes in content.question.image_phash.
 *
 * Only the stem image participates. A question's stem image is what makes it
 * visually distinct; option images (target_role != 'stem') are not part of
 * identity here because this bank has none (all 15 assets are target_role
 * 'stem'), and inventing a composition rule for data that does not exist
 * would be guesswork.
 *
 * Setting image_phash re-fires migration 037's identity trigger (it watches
 * that column), so dedup_key is recomputed automatically for the affected
 * rows — the hash cannot drift out of sync with the identity that uses it.
 *
 *   npx tsx db/scripts/backfill-image-phash.ts --dry-run
 *   npx tsx db/scripts/backfill-image-phash.ts --execute
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { Jimp } from "jimp";
import { pool } from "../shared/pool.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const execute = args.includes("--execute");

if (!dryRun && !execute) {
  console.error("usage: backfill-image-phash.ts (--dry-run | --execute)");
  process.exit(1);
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.OBJECT_STORAGE_BUCKET ?? "content-assets";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to read the asset bucket");
  process.exit(1);
}

const storage = createClient(SUPABASE_URL, SERVICE_KEY).storage.from(BUCKET);

/** dHash: 9x8 greyscale, one bit per horizontal adjacent-pixel comparison. */
async function dHash(buf: Buffer): Promise<Buffer> {
  const img = await Jimp.read(buf);
  img.greyscale().resize({ w: 9, h: 8 });
  const out = Buffer.alloc(8);
  for (let y = 0; y < 8; y++) {
    let rowBits = 0;
    for (let x = 0; x < 8; x++) {
      const left = img.bitmap.data[(img.bitmap.width * y + x) * 4];
      const right = img.bitmap.data[(img.bitmap.width * y + x + 1) * 4];
      if (left > right) rowBits |= 1 << (7 - x);
    }
    out[y] = rowBits;
  }
  return out;
}

async function main(): Promise<void> {
  const assets = await pool.query<{ question_id: string; question_uid: string; storage_uri: string }>(
    `select a.question_id, q.question_uid, a.storage_uri
       from content.asset a
       join content.question q on q.question_id = a.question_id
      where a.target_role = 'stem'
        and a.question_id is not null
        and a.storage_uri is not null
      order by a.display_order, a.asset_id`
  );
  console.log(`${assets.rows.length} stem image(s) to hash${dryRun ? " (DRY RUN)" : ""}.`);

  const hashes = new Map<string, string[]>(); // phash hex -> question_uids, for collision reporting
  let ok = 0;
  let failed = 0;

  for (const a of assets.rows) {
    try {
      const dl = await storage.download(a.storage_uri);
      if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "empty download");
      const phash = await dHash(Buffer.from(await dl.data.arrayBuffer()));
      const hex = phash.toString("hex");

      const seen = hashes.get(hex) ?? [];
      seen.push(a.question_uid);
      hashes.set(hex, seen);

      if (execute) {
        await pool.query(`update content.question set image_phash = $1 where question_id = $2`, [phash, a.question_id]);
      }
      console.log(`  ${a.question_uid}  phash=${hex}`);
      ok++;
    } catch (err) {
      // A missing or unreadable object must not abort the run — report it and
      // leave that row's image_phash NULL, which keeps it out of any identity
      // match rather than matching it wrongly.
      console.warn(`  ${a.question_uid}  SKIPPED: ${(err as Error).message}`);
      failed++;
    }
  }

  console.log(`\n${ok} hashed, ${failed} skipped.`);

  const collisions = [...hashes.entries()].filter(([, uids]) => uids.length > 1);
  if (collisions.length > 0) {
    console.log(`\nPerceptually identical image(s) across questions — review, do not auto-merge:`);
    for (const [hex, uids] of collisions) console.log(`  ${hex}  ${uids.join(", ")}`);
  }
  if (!execute) console.log("\nDry run — nothing written.");
}

main()
  .catch((err) => {
    console.error("image phash backfill failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
