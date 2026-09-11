import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * db/scripts/dedup/paths.ts — where the toolkit expects things to live.
 *
 * One module so that a path is never spelled twice. Every one of these is
 * overridable on the command line (`--bank-root`, `--batch-root`), because a
 * dry run against a copy of the tree is the cheapest way to check a change.
 */

/** The Phase 4 target tree. */
export const BANK_ROOT = path.join("db", "content", "bank");

/**
 * The pre-restructure tree. Still the live location until
 * `dedup-cli restructure --apply` has run, and the home of `assets/`
 * permanently — db/scripts/import/import-content.ts infers image directories
 * from it.
 */
export const LEGACY_BATCH_ROOT = path.join("db", "content", "content-batches");

export function bankPaths(root: string) {
  return {
    live: path.join(root, "live"),
    batches: path.join(root, "batches"),
    incoming: path.join(root, "incoming"),
    staged: path.join(root, "staged"),
    rejected: path.join(root, "rejected"),
    quarantine: path.join(root, "_quarantine"),
    manifests: path.join(root, "manifests"),
    reports: path.join(root, "reports"),
  };
}

export function sha256HexOfFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export { RunLog, parseFlags, csvRow, csvCell, truncate } from "./runlog.js";
export type { CommonFlags } from "./runlog.js";
