import fs from "node:fs";
import path from "node:path";
import { pool } from "../../shared/pool.js";
import { buildClusters } from "./cluster.js";
import { RunLog, parseFlags, truncate } from "./runlog.js";
import { loadBatchRecords } from "./sources/batch.js";
import { loadLiveRecords } from "./sources/db.js";
import type { CanonicalRecord } from "./types.js";

/**
 * Phase 3 — content batch dedup.
 *
 *   npx tsx db/scripts/dedup/batch-dedup.ts                    # dry run
 *   npx tsx db/scripts/dedup/batch-dedup.ts --apply
 *
 * WHAT COUNTS AS A DUPLICATE HERE, AND WHAT DOES NOT
 * ---------------------------------------------------
 * By default this deduplicates the content folder AGAINST ITSELF only:
 *
 *   * across batches    — the same question emitted into two files;
 *   * within each batch — the same question emitted twice into one file.
 *
 * Both are one clustering run over all file records at once; separating them
 * would be two half-answers to the same question.
 *
 * It does NOT, by default, remove a question just because that question is
 * also published in the live database. That was the original behaviour and it
 * was wrong: a file copy of a live row is not a duplicate *within the folder*,
 * it is the authoring source the row was imported from. Removing those emptied
 * the batch files of 480 perfectly good distinct questions, leaving the folder
 * no longer a record of what was authored.
 *
 * `--against-live` opts into the old behaviour. It is genuinely useful before
 * a re-import — a file whose question is already published will be rejected by
 * the ingestion gate anyway — but it is a different operation from "remove the
 * duplicates in this folder", so it is not the default.
 *
 * NOTHING IS DELETED. Removed items are written to
 * `<content-root>/_quarantine/<run_id>/<original path>.removed.jsonl`, one
 * JSON object per line, each carrying its original file, index and the reason
 * it was removed. The rewrite is only performed after every quarantine file
 * has been written and flushed.
 */

const DEFAULT_BATCH_ROOT = path.join("db", "content", "content-batches");

interface Removal {
  record: CanonicalRecord;
  reason: string;
  survivorRef: string;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const log = new RunLog("batch-dedup", flags.runId);
  const batchRoot = typeof flags.raw["batch-root"] === "string" ? flags.raw["batch-root"] : DEFAULT_BATCH_ROOT;

  try {
    log.say("run_id: " + flags.runId);
    log.say(flags.dryRun ? "DRY RUN — no file is rewritten." : "APPLY — batch files will be rewritten.");

    const batch = loadBatchRecords(batchRoot);
    if (batch.failures.length > 0) {
      for (const failure of batch.failures) {
        log.say("PARSE FAILURE " + failure.filePath + ": " + failure.error, { level: "error" });
      }
      log.say("");
      log.say("Refusing to rewrite anything while a file in the tree cannot be parsed:");
      log.say("its questions were never compared, so a 'survivor' elected without them");
      log.say("could be a duplicate of something in the unreadable file.");
      await log.close("failed", { parseFailures: batch.failures.length });
      process.exitCode = 1;
      return;
    }

    log.say("files: " + batch.perFileCounts.size + ", questions: " + batch.records.length);

    // --- optional pass: against the live bank ------------------------------
    const againstLive = flags.raw["against-live"] === true;
    const removals: Removal[] = [];
    let survivingRecords: CanonicalRecord[] = batch.records;

    if (againstLive) {
      const live = await loadLiveRecords({ lifecycleStatus: "published", withReferenceCounts: false });
      const liveByHash = new Map<string, CanonicalRecord>();
      for (const record of live) if (!liveByHash.has(record.matchHash)) liveByHash.set(record.matchHash, record);

      survivingRecords = [];
      for (const record of batch.records) {
        const liveMatch = liveByHash.get(record.matchHash);
        if (liveMatch) {
          removals.push({
            record,
            reason: "tier 1 — already published in the live bank",
            survivorRef: liveMatch.questionUid ?? liveMatch.questionId ?? "live",
          });
        } else {
          survivingRecords.push(record);
        }
      }
      log.say("--against-live: " + removals.length + " removed as already published, " + survivingRecords.length + " remain");
    } else {
      log.say("comparing the folder against itself only (pass --against-live to also drop questions already published)");
    }

    // --- passes 2+3: file records against each other -----------------------
    const { clusters, reviewPairs } = buildClusters(survivingRecords);
    for (const cluster of clusters) {
      for (const loser of cluster.losers) {
        const sameFile = loser.filePath === cluster.survivor.filePath;
        removals.push({
          record: loser,
          reason:
            "tier " + cluster.tier + " — " + (sameFile ? "duplicate within the same batch file" : "duplicate across batch files") +
            " (survivor chosen by " + cluster.survivorReason + ")",
          survivorRef:
            (cluster.survivor.questionUid ?? cluster.survivor.stableId) +
            " @ " + (cluster.survivor.filePath ?? "?").replace(/\\/g, "/") +
            "#" + cluster.survivor.fileIndex,
        });
      }
    }
    const fileRemovals = removals.length - (batch.records.length - survivingRecords.length);
    log.say("within and across batch files: " + fileRemovals + " duplicate(s) removed");
    log.say("tier 3 pairs for review: " + reviewPairs.length);

    const removedByRecord = new Set(removals.map((r) => r.record));
    const kept = batch.records.filter((r) => !removedByRecord.has(r));
    log.say("");
    log.say("before: " + batch.records.length + "   after: " + kept.length + "   removed: " + removals.length);

    const report = renderReport({
      runId: flags.runId,
      batchRoot,
      dryRun: flags.dryRun,
      perFileCounts: batch.perFileCounts,
      removals,
      kept,
      total: batch.records.length,
    });
    log.writeReport("batch_dedup_report.md", report);

    if (flags.dryRun) {
      log.say("");
      log.say("STOP POINT 3. Dry run. Review db/reports/dedup/" + flags.runId + "/batch_dedup_report.md,");
      log.say("then re-run with --apply --run-id " + flags.runId + ".");
      await log.close("ok", { removed: removals.length, applied: false });
      return;
    }

    // --- quarantine BEFORE rewriting ---------------------------------------
    const quarantineRoot = path.join(batchRoot, "_quarantine", flags.runId);
    const removalsByFile = new Map<string, Removal[]>();
    for (const removal of removals) {
      const key = removal.record.filePath ?? "(unknown)";
      const list = removalsByFile.get(key);
      if (list) list.push(removal);
      else removalsByFile.set(key, [removal]);
    }

    for (const [filePath, list] of removalsByFile) {
      const relative = path.relative(batchRoot, filePath);
      const target = path.join(quarantineRoot, relative + ".removed.jsonl");
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const lines = list
        .sort((a, b) => (a.record.fileIndex ?? 0) - (b.record.fileIndex ?? 0))
        .map((removal) =>
          JSON.stringify({
            _dedup: {
              runId: flags.runId,
              originalFile: filePath.replace(/\\/g, "/"),
              originalIndex: removal.record.fileIndex,
              reason: removal.reason,
              survivor: removal.survivorRef,
              matchHash: removal.record.matchHash,
              stableId: removal.record.stableId,
            },
            question: removal.record.raw,
          })
        );
      fs.writeFileSync(target, lines.join("\n") + "\n", "utf8");
      log.event("quarantined", { file: target, count: list.length });
    }
    log.say("quarantined " + removals.length + " question(s) under " + quarantineRoot.replace(/\\/g, "/"));

    // --- rewrite -----------------------------------------------------------
    const keptByFile = new Map<string, CanonicalRecord[]>();
    for (const record of kept) {
      const key = record.filePath!;
      const list = keptByFile.get(key);
      if (list) list.push(record);
      else keptByFile.set(key, [record]);
    }

    let rewritten = 0;
    for (const filePath of batch.perFileCounts.keys()) {
      const survivors = (keptByFile.get(filePath) ?? []).sort(
        (a, b) => (a.fileIndex ?? 0) - (b.fileIndex ?? 0)
      );
      const payload = survivors.map((r) => r.raw);
      // Written in the file's existing shape (a top-level array), not
      // converted to JSONL here — the format change belongs to Phase 4's
      // restructure, and doing both at once would make a diff unreadable.
      fs.writeFileSync(filePath, JSON.stringify(payload, null, 2) + "\n", "utf8");
      rewritten++;
    }
    log.say("rewrote " + rewritten + " batch file(s)");

    await log.close("ok", { removed: removals.length, kept: kept.length, applied: true });
  } catch (error) {
    log.say("batch-dedup failed: " + (error as Error).message, { level: "error" });
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function renderReport(input: {
  runId: string;
  batchRoot: string;
  dryRun: boolean;
  perFileCounts: Map<string, number>;
  removals: Removal[];
  kept: CanonicalRecord[];
  total: number;
}): string {
  const lines: string[] = [];
  const push = (text = "") => lines.push(text);

  const removedByFile = new Map<string, number>();
  for (const removal of input.removals) {
    const key = removal.record.filePath ?? "(unknown)";
    removedByFile.set(key, (removedByFile.get(key) ?? 0) + 1);
  }

  push("# batch_dedup_report.md");
  push();
  push("run_id: `" + input.runId + "`  ");
  push("mode: " + (input.dryRun ? "**dry run** — no file was rewritten" : "**applied**") + "  ");
  push("root: `" + input.batchRoot.replace(/\\/g, "/") + "`");
  push();
  push("| metric | value |");
  push("|---|---:|");
  push("| questions before | " + input.total + " |");
  push("| questions after | " + input.kept.length + " |");
  push("| removed | **" + input.removals.length + "** |");
  push();
  push("Removed items are quarantined, never deleted:");
  push("`" + input.batchRoot.replace(/\\/g, "/") + "/_quarantine/" + input.runId + "/<original path>.removed.jsonl`");
  push();

  push("## Per-file before / after");
  push();
  push("| file | before | after | removed |");
  push("|---|---:|---:|---:|");
  for (const [file, before] of [...input.perFileCounts].sort((a, b) => a[0].localeCompare(b[0]))) {
    const removed = removedByFile.get(file) ?? 0;
    push("| `" + file.replace(/\\/g, "/") + "` | " + before + " | " + (before - removed) + " | " + removed + " |");
  }
  push();

  push("## Removal reasons");
  push();
  const byReason = new Map<string, number>();
  for (const removal of input.removals) {
    const key = removal.reason.split(" (survivor")[0];
    byReason.set(key, (byReason.get(key) ?? 0) + 1);
  }
  push("| reason | count |");
  push("|---|---:|");
  for (const [reason, count] of [...byReason].sort((a, b) => b[1] - a[1])) {
    push("| " + reason + " | " + count + " |");
  }
  push();

  push("## Where each removal went");
  push();
  push("| original file | index | question_uid | survivor | reason |");
  push("|---|---:|---|---|---|");
  for (const removal of input.removals.slice(0, 500)) {
    push(
      "| `" + (removal.record.filePath ?? "").replace(/\\/g, "/") + "` | " +
      removal.record.fileIndex + " | `" + (removal.record.questionUid ?? removal.record.stableId) +
      "` | `" + truncate(removal.survivorRef, 70) + "` | " + truncate(removal.reason, 90) + " |"
    );
  }
  if (input.removals.length > 500) {
    push();
    push("… " + (input.removals.length - 500) + " further removals omitted from this table; every one of them is");
    push("in the quarantine files, which are the complete record.");
  }
  push();

  return lines.join("\n");
}

main();
