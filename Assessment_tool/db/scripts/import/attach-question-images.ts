import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../../shared/pool.js";
import { uploadAsset } from "../../content/asset-resolver.js";

/**
 * LA-UX-REFRESH-003 H2 — attach image files to questions that are ALREADY in
 * the bank.
 *
 * Why this exists as a separate tool from import-content.ts: that importer
 * uploads an `images[]` array at the moment a question is created, and there
 * is no way back into it for a question that is already imported. Live state
 * on 2026-09-08 is exactly that case — `content.asset` holds 0 rows, all 1140
 * published questions have `has_image = false`, and image-only practice
 * therefore has nothing to assemble a paper from. The 23 PNGs that exist on
 * disk belong to batches whose questions were replaced.
 *
 * `content.question.has_image` is NOT set here, and must not be: migration
 * 028 makes it a trigger-maintained mirror of "does this question own a
 * content.asset row". Writing the asset flips it; writing both would be two
 * sources of truth for one fact.
 *
 * Matching is by question_uid, taken from the file name. The convention the
 * existing assets follow is `<SUBJ>_<TOPIC>_DIAG_<NNNN>.png`, which does NOT
 * contain a question_uid — so the default mode requires an explicit mapping
 * file, and the uid-in-filename mode is opt-in. Guessing a mapping between
 * a diagram and a question is exactly the kind of silent wrong answer this
 * codebase avoids elsewhere: a diagram attached to the wrong stem is worse
 * than no diagram.
 *
 * Usage:
 *   npx tsx db/scripts/import/attach-question-images.ts --map <mapping.json> [--assets-dir <dir>] [--live]
 *   npx tsx db/scripts/import/attach-question-images.ts --uid-from-filename --assets-dir <dir> [--live]
 *
 * Mapping file shape:
 *   [{ "questionUid": "LMN-PHY-PHY07-001057",
 *      "fileName": "PHY_NLM_DIAG_0001.png",
 *      "altText": "Atwood machine with m1 = 3 kg and m2 = 5 kg",
 *      "targetRole": "stem" }]
 *
 * DRY RUN by default: it resolves and reports every pair, and writes nothing
 * anywhere, until --live is passed.
 */

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");
const DEFAULT_ASSETS_DIR = path.resolve(REPO_ROOT, "db", "content", "content-batches", "assets");

type TargetRole = "stem" | "option" | "solution";

interface MappingEntry {
  questionUid: string;
  fileName: string;
  altText?: string;
  targetRole?: TargetRole;
  optionLabel?: string;
}

interface ResolvedPair extends MappingEntry {
  questionId: string;
  absolutePath: string;
  optionId?: string;
}

interface Rejection {
  entry: MappingEntry;
  reason: string;
}

function parseArgs(argv: string[]) {
  const live = argv.includes("--live");
  const uidFromFilename = argv.includes("--uid-from-filename");
  const mapIndex = argv.indexOf("--map");
  const mapFile = mapIndex >= 0 ? argv[mapIndex + 1] : undefined;
  const dirIndex = argv.indexOf("--assets-dir");
  const assetsDir = dirIndex >= 0 ? argv[dirIndex + 1] : undefined;

  if (!mapFile && !uidFromFilename) {
    console.error("Usage: attach-question-images.ts --map <mapping.json> [--assets-dir <dir>] [--live]");
    console.error("   or: attach-question-images.ts --uid-from-filename --assets-dir <dir> [--live]");
    process.exit(1);
  }
  return { live, uidFromFilename, mapFile, assetsDir };
}

function listImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listImageFiles(full));
    else if (/\.(png|jpe?g|webp|gif|svg)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function readMapping(mapFile: string): MappingEntry[] {
  const raw = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), mapFile), "utf8"));
  if (!Array.isArray(raw)) throw new Error("mapping file must be a JSON array");
  return raw as MappingEntry[];
}

/**
 * Opt-in mode: treat the file's base name as the question_uid. Only useful
 * when whoever produced the files named them that way; it is never inferred,
 * because a near-miss here silently attaches a diagram to the wrong question.
 */
function mappingFromFilenames(files: string[]): MappingEntry[] {
  return files.map((absolutePath) => ({
    questionUid: path.basename(absolutePath, path.extname(absolutePath)),
    fileName: path.basename(absolutePath),
    targetRole: "stem" as const,
  }));
}

async function resolveQuestionIds(entries: MappingEntry[]): Promise<Map<string, string>> {
  const uids = [...new Set(entries.map((e) => e.questionUid))];
  if (uids.length === 0) return new Map();
  const res = await pool.query<{ question_uid: string; question_id: string }>(
    `select question_uid, question_id
       from content.question
      where question_uid = any($1::text[])
        and is_deleted is not true`,
    [uids]
  );
  return new Map(res.rows.map((r) => [r.question_uid, r.question_id]));
}

async function resolveOptionId(questionId: string, optionLabel: string): Promise<string | undefined> {
  const res = await pool.query<{ option_id: string }>(
    `select option_id from content.question_option where question_id = $1 and option_label = $2`,
    [questionId, optionLabel]
  );
  return res.rows[0]?.option_id;
}

async function main(): Promise<void> {
  const { live, uidFromFilename, mapFile, assetsDir: assetsDirArg } = parseArgs(process.argv.slice(2));
  const assetsDir = assetsDirArg ? path.resolve(process.cwd(), assetsDirArg) : DEFAULT_ASSETS_DIR;

  console.log(`mode:        ${live ? "LIVE" : "DRY RUN (no writes)"}`);
  console.log(`assets dir:  ${assetsDir}`);

  const filesOnDisk = listImageFiles(assetsDir);
  console.log(`image files: ${filesOnDisk.length}`);

  const entries = mapFile ? readMapping(mapFile) : mappingFromFilenames(filesOnDisk);
  console.log(`mapping:     ${mapFile ?? "(derived from file names)"} — ${entries.length} entries\n`);

  // Index by base name so a mapping may name a file that lives in any
  // subdirectory of the assets tree, which is how batch-N/ is laid out.
  const byBaseName = new Map<string, string>();
  for (const f of filesOnDisk) {
    const base = path.basename(f);
    if (!byBaseName.has(base)) byBaseName.set(base, f);
  }

  const questionIdByUid = await resolveQuestionIds(entries);

  const resolved: ResolvedPair[] = [];
  const rejected: Rejection[] = [];

  for (const entry of entries) {
    const questionId = questionIdByUid.get(entry.questionUid);
    if (!questionId) {
      rejected.push({ entry, reason: `no published question with question_uid "${entry.questionUid}"` });
      continue;
    }
    const absolutePath = byBaseName.get(entry.fileName);
    if (!absolutePath) {
      rejected.push({ entry, reason: `image file "${entry.fileName}" not found under ${assetsDir}` });
      continue;
    }
    const targetRole: TargetRole = entry.targetRole ?? "stem";
    let optionId: string | undefined;
    if (targetRole === "option") {
      if (!entry.optionLabel) {
        rejected.push({ entry, reason: `targetRole "option" requires an optionLabel` });
        continue;
      }
      optionId = await resolveOptionId(questionId, entry.optionLabel);
      if (!optionId) {
        rejected.push({ entry, reason: `question has no option labelled "${entry.optionLabel}"` });
        continue;
      }
    }
    resolved.push({ ...entry, targetRole, questionId, absolutePath, optionId });
  }

  const mappedFiles = new Set(resolved.map((r) => path.basename(r.absolutePath)));
  const orphanFiles = filesOnDisk.map((f) => path.basename(f)).filter((f) => !mappedFiles.has(f));

  console.log(`resolved:    ${resolved.length}`);
  console.log(`rejected:    ${rejected.length}`);
  console.log(`unreferenced files on disk: ${orphanFiles.length}\n`);

  for (const r of rejected) {
    console.log(`  REJECT ${r.entry.questionUid} <- ${r.entry.fileName}: ${r.reason}`);
  }
  if (orphanFiles.length > 0) {
    console.log(`\n  files nothing maps to: ${orphanFiles.join(", ")}`);
  }

  if (!live) {
    console.log(`\nDRY RUN — nothing written. Re-run with --live to attach ${resolved.length} image(s).`);
    await pool.end();
    return;
  }

  if (resolved.length === 0) {
    console.log("\nNothing to attach.");
    await pool.end();
    return;
  }

  let attached = 0;
  const failures: string[] = [];
  for (const r of resolved) {
    try {
      // uploadAsset is idempotent on storage_uri: re-running updates the
      // existing row rather than creating a duplicate asset for the same
      // file, so this script is safe to run twice.
      await uploadAsset({
        localFilePath: r.absolutePath,
        questionId: r.questionId,
        optionId: r.optionId,
        targetRole: r.targetRole,
        altText: r.altText,
      });
      attached++;
      console.log(`  OK ${r.questionUid} <- ${r.fileName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${r.questionUid} <- ${r.fileName}: ${message}`);
      console.log(`  FAIL ${r.questionUid} <- ${r.fileName}: ${message}`);
    }
  }

  // has_image is trigger-maintained (migration 028); read it back rather than
  // asserting it, so the run reports what the database actually believes.
  const check = await pool.query<{ n: string }>(
    `select count(*) as n from content.question
      where has_image = true and lifecycle_status = 'published' and is_deleted is not true`
  );

  console.log(`\nattached: ${attached}, failed: ${failures.length}`);
  console.log(`published questions now flagged has_image: ${check.rows[0].n}`);
  if (failures.length > 0) process.exitCode = 1;

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
