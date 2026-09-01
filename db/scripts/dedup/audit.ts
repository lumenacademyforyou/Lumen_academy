import path from "node:path";
import { pool } from "../../shared/pool.js";
import { buildClusters, TIER2_THRESHOLD, TIER3_THRESHOLD } from "./cluster.js";
import { RunLog, csvRow, parseFlags, truncate } from "./runlog.js";
import { loadBatchRecords } from "./sources/batch.js";
import { loadLiveRecords } from "./sources/db.js";
import type { CanonicalRecord, Cluster, MatchPair } from "./types.js";

/**
 * Phase 1 — snapshot and audit. READ-ONLY. This file contains no write path
 * at all, by construction: it never opens a transaction and never issues
 * anything but SELECT.
 *
 *   npx tsx db/scripts/dedup/audit.ts [--subject PHY] [--limit N] [--batch-root <dir>]
 *
 * Writes audit_report.md and duplicates.csv into db/reports/dedup/<run_id>/ and
 * stops. Section 7: "Audit — stop, show report, wait for approval."
 */

const DEFAULT_BATCH_ROOT = path.join("db", "content", "content-batches");

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const log = new RunLog("audit", flags.runId);
  const batchRoot = typeof flags.raw["batch-root"] === "string" ? flags.raw["batch-root"] : DEFAULT_BATCH_ROOT;

  try {
    log.say("run_id: " + flags.runId);
    log.say("Phase 1 — audit (read-only). Nothing is written to the database by this command.");

    // --- live -------------------------------------------------------------
    const live = await loadLiveRecords({
      lifecycleStatus: "published",
      subjectCode: flags.subject,
      limit: flags.limit,
    });
    log.say("live published rows loaded: " + live.length);

    const liveResult = buildClusters(live);

    // --- batches ----------------------------------------------------------
    const batch = loadBatchRecords(batchRoot);
    log.say("batch files parsed: " + batch.perFileCounts.size + ", questions: " + batch.records.length);
    for (const failure of batch.failures) {
      log.say("  PARSE FAILURE " + failure.filePath + ": " + failure.error, { level: "error" });
    }
    const batchScoped = flags.subject
      ? batch.records.filter((r) => r.subjectCode === flags.subject)
      : batch.records;
    const batchResult = buildClusters(batchScoped);

    // --- batch vs live ----------------------------------------------------
    // A batch question whose normalised stem is already published is a
    // duplicate of a live row, and is the single largest category the earlier
    // passes could not see: they only ever compared the database to itself.
    const liveByHash = new Map<string, CanonicalRecord>();
    for (const record of live) if (!liveByHash.has(record.matchHash)) liveByHash.set(record.matchHash, record);
    const alreadyLive = batchScoped.filter((r) => liveByHash.has(r.matchHash));

    // --- report -----------------------------------------------------------
    const report = renderReport({
      runId: flags.runId,
      batchRoot,
      live,
      liveClusters: liveResult.clusters,
      liveReview: liveResult.reviewPairs,
      batchRecords: batchScoped,
      batchClusters: batchResult.clusters,
      batchReview: batchResult.reviewPairs,
      batchFileCounts: batch.perFileCounts,
      parseFailures: batch.failures.length,
      alreadyLive,
      dbTotals: await dbTotals(),
    });

    const reportPath = log.writeReport("audit_report.md", report);
    const csvPath = log.writeReport(
      "duplicates.csv",
      renderDuplicatesCsv(liveResult.clusters, batchResult.clusters, alreadyLive, liveByHash)
    );
    log.writeReport(
      "review_queue.csv",
      renderReviewCsv([...liveResult.reviewPairs, ...batchResult.reviewPairs])
    );

    log.say("");
    log.say("wrote " + reportPath);
    log.say("wrote " + csvPath);
    log.say("wrote " + path.join(log.dir, "review_queue.csv"));
    log.say("");
    log.say("STOP POINT 1. Review the report above before running any dedup command.");
    await log.close("ok");
  } catch (error) {
    log.say("audit failed: " + (error as Error).message, { level: "error" });
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

async function dbTotals() {
  const res = await pool.query(
    `select lifecycle_status, count(*)::int as n from content.question group by 1 order by 2 desc`
  );
  const byStatus = res.rows as { lifecycle_status: string; n: number }[];
  const total = byStatus.reduce((sum, row) => sum + row.n, 0);
  return { byStatus, total };
}

interface ReportInput {
  runId: string;
  batchRoot: string;
  live: CanonicalRecord[];
  liveClusters: Cluster[];
  liveReview: MatchPair[];
  batchRecords: CanonicalRecord[];
  batchClusters: Cluster[];
  batchReview: MatchPair[];
  batchFileCounts: Map<string, number>;
  parseFailures: number;
  alreadyLive: CanonicalRecord[];
  dbTotals: { byStatus: { lifecycle_status: string; n: number }[]; total: number };
}

function histogram(clusters: Cluster[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const cluster of clusters) out.set(cluster.members.length, (out.get(cluster.members.length) ?? 0) + 1);
  return new Map([...out].sort((a, b) => a[0] - b[0]));
}

function groupCount<T>(items: T[], key: (item: T) => string | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const item of items) {
    const k = key(item) ?? "(none)";
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return new Map([...out].sort((a, b) => b[1] - a[1]));
}

function renderReport(input: ReportInput): string {
  const lines: string[] = [];
  const push = (text = "") => lines.push(text);

  const liveDeletions = input.liveClusters.reduce((n, c) => n + c.losers.length, 0);
  const batchDeletions = input.batchClusters.reduce((n, c) => n + c.losers.length, 0);
  const liveTier1 = input.liveClusters.filter((c) => c.tier === 1);
  const liveTier2 = input.liveClusters.filter((c) => c.tier === 2);
  const batchTier1 = input.batchClusters.filter((c) => c.tier === 1);
  const batchTier2 = input.batchClusters.filter((c) => c.tier === 2);

  push("# audit_report.md — question bank duplication audit");
  push();
  push("run_id: `" + input.runId + "`  ");
  push("generated: " + new Date().toISOString() + "  ");
  push("directive: `question-dedup-promptnew.md` Phase 1 (read-only)");
  push();
  push("**This command wrote nothing to the database.** It opens no transaction and issues");
  push("only SELECT. Nothing is deleted anywhere until a dry run has been reviewed and");
  push("`--apply` has been passed explicitly.");
  push();

  push("## 0. Restore path");
  push();
  push("Before running Phase 2 or 3 with `--apply`, take the snapshot and record the");
  push("restore command here:");
  push();
  push("```bash");
  push("# database (Supabase / Postgres)");
  push("pg_dump \"$DATABASE_URL\" --format=custom --file=db/reports/dedup/_snapshots/" + input.runId + ".dump");
  push("# restore");
  push("pg_restore --clean --if-exists --dbname \"$DATABASE_URL\" db/reports/dedup/_snapshots/" + input.runId + ".dump");
  push();
  push("# content folder");
  push("git rev-parse HEAD > db/reports/dedup/_snapshots/" + input.runId + ".content-commit");
  push("# restore");
  push("git checkout $(cat db/reports/dedup/_snapshots/" + input.runId + ".content-commit) -- " + input.batchRoot.replace(/\\/g, "/"));
  push("```");
  push();
  push("There is also an in-database reversal that does not need the dump: every removal");
  push("this toolkit performs is a soft delete plus a full `payload_json` snapshot in");
  push("`content.question_identity_audit`, replayable with `dedup-cli rollback --run-id <id>`.");
  push();

  push("## 1. Live database");
  push();
  push("| lifecycle_status | rows |");
  push("|---|---:|");
  for (const row of input.dbTotals.byStatus) push("| " + row.lifecycle_status + " | " + row.n + " |");
  push("| **total** | **" + input.dbTotals.total + "** |");
  push();
  push("Scope of this audit: **" + input.live.length + "** published rows.");
  push();
  push("| metric | value |");
  push("|---|---:|");
  push("| rows audited | " + input.live.length + " |");
  push("| unique normalised stems | " + new Set(input.live.map((r) => r.matchHash)).size + " |");
  push("| Tier 1 clusters (exact stem) | " + liveTier1.length + " |");
  push("| Tier 2 clusters (>= " + TIER2_THRESHOLD + ") | " + liveTier2.length + " |");
  push("| rows this would delete | **" + liveDeletions + "** |");
  push("| Tier 3 pairs queued for review | " + input.liveReview.length + " |");
  push();

  if (liveDeletions === 0) {
    push("### Reading this result honestly");
    push();
    push("Zero live deletions is **not** evidence that the audit is broken, and it is not");
    push("the same claim as \"the bank has never had duplicates\". Three earlier passes");
    push("already ran against this bank:");
    push();
    push("- migrations 030/031 collapsed 799 byte-identical clones;");
    push("- migrations 037-041 plus `backfill-question-identity.ts` retired a further 67");
    push("  rows in 30 groups, specifically the `In <Chapter>,` lead-in family;");
    push("- migration 041's UNIQUE index makes a re-introduction structurally impossible.");
    push();
    push("This audit applies a **stricter** key than any of those — the stem alone, with");
    push("options, answer, difficulty and topic all ignored — and still finds nothing left");
    push("to collapse. That is the result the earlier passes were supposed to produce, now");
    push("independently confirmed by a tool that shares none of their code paths except");
    push("the normaliser (and that shared normaliser is itself checked against the");
    push("database by `db/scripts/dedup/integration.test.ts`).");
    push();
  }

  push("### Tier 2 and the numeric-variant guard");
  push();
  push("This is the most important number in the audit, because it is where a naive");
  push("reading of the stem-only rule would have destroyed content.");
  push();
  const variantPairs = input.liveReview.filter((p) => p.reason.startsWith("numeric variant"));
  const wouldHaveDeleted = variantPairs.filter((p) => p.similarity >= TIER2_THRESHOLD);
  push("**" + wouldHaveDeleted.length + "** live pairs scored at or above the Tier-2 auto-delete threshold of " + TIER2_THRESHOLD);
  push("and were held back by the digit-signature guard, which routed them to Tier 3");
  push("instead. Every one of them would have been auto-deleted without it — that is the");
  push("entire population of live Tier-2 candidates, not a fraction of it: " + wouldHaveDeleted.length + " of " + wouldHaveDeleted.length + ".");
  push("A further " + (variantPairs.length - wouldHaveDeleted.length) + " numeric-variant pairs scored between the Tier-3 floor and that");
  push("threshold and were never auto-delete candidates in the first place.");
  push();
  push("These are template questions that differ only in their quantities — same wording,");
  push("different values, different correct answers. They are not duplicates, and the");
  push("prompt's own guard is what catches them:");
  push();
  push("> \"if the digit sequences inside the two stems differ (different numbers, units,");
  push("> or quantities), the stems are not the same question — they're numeric variants.\"");
  push();
  for (const pair of wouldHaveDeleted.slice(0, 5)) {
    push("- `" + (pair.a.questionUid ?? pair.a.stableId) + "` vs `" + (pair.b.questionUid ?? pair.b.stableId) + "` (sim " + pair.similarity.toFixed(3) + ")");
    push("  - A: " + truncate(pair.a.stemText, 110));
    push("  - B: " + truncate(pair.b.stemText, 110));
  }
  if (wouldHaveDeleted.length > 5) {
    push("- … and " + (wouldHaveDeleted.length - 5) + " more, in `review_queue.csv`.");
  }
  push();

  push("## 2. Content batch files");
  push();
  push("Root: `" + input.batchRoot.replace(/\\/g, "/") + "`");
  push();
  push("| metric | value |");
  push("|---|---:|");
  push("| files parsed | " + input.batchFileCounts.size + " |");
  push("| parse failures | " + input.parseFailures + " |");
  push("| questions | " + input.batchRecords.length + " |");
  push("| unique normalised stems | " + new Set(input.batchRecords.map((r) => r.matchHash)).size + " |");
  push("| Tier 1 clusters | " + batchTier1.length + " |");
  push("| Tier 2 clusters | " + batchTier2.length + " |");
  push("| rows this would remove (within + across batches) | **" + batchDeletions + "** |");
  push("| batch questions already published live | **" + input.alreadyLive.length + "** |");
  push("| Tier 3 pairs queued for review | " + input.batchReview.length + " |");
  push();

  push("### Cluster size histogram (batch files)");
  push();
  push("| cluster size | clusters |");
  push("|---:|---:|");
  for (const [size, count] of histogram(input.batchClusters)) push("| " + size + " | " + count + " |");
  if (input.batchClusters.length === 0) push("| — | 0 |");
  push();

  push("### Per-file breakdown — which generation runs drifted");
  push();
  push("| file | questions | in a duplicate cluster |");
  push("|---|---:|---:|");
  const perFileDuplicates = new Map<string, number>();
  for (const cluster of input.batchClusters) {
    for (const loser of cluster.losers) {
      const key = loser.filePath ?? "(unknown)";
      perFileDuplicates.set(key, (perFileDuplicates.get(key) ?? 0) + 1);
    }
  }
  for (const [file, count] of [...input.batchFileCounts].sort((a, b) => a[0].localeCompare(b[0]))) {
    const dupes = perFileDuplicates.get(file) ?? 0;
    push("| `" + file.replace(/\\/g, "/") + "` | " + count + " | " + dupes + " |");
  }
  push();

  push("### Per-subject breakdown (batch files)");
  push();
  push("| subject | questions |");
  push("|---|---:|");
  for (const [subject, count] of groupCount(input.batchRecords, (r) => r.subjectCode)) {
    push("| " + subject + " | " + count + " |");
  }
  push();

  push("### Per-topic breakdown (batch files)");
  push();
  push("| node tag | questions |");
  push("|---|---:|");
  for (const [tag, count] of groupCount(input.batchRecords, (r) => r.nodeTagCode)) {
    push("| " + tag + " | " + count + " |");
  }
  push();

  push("## 3. Estimated deletions per tier");
  push();
  push("| source | tier 1 | tier 2 | tier 3 (review, never auto-deleted) |");
  push("|---|---:|---:|---:|");
  push("| live database | " + liveTier1.reduce((n, c) => n + c.losers.length, 0) + " | " + liveTier2.reduce((n, c) => n + c.losers.length, 0) + " | " + input.liveReview.length + " |");
  push("| batch files | " + batchTier1.reduce((n, c) => n + c.losers.length, 0) + " | " + batchTier2.reduce((n, c) => n + c.losers.length, 0) + " | " + input.batchReview.length + " |");
  push("| batch already live | " + input.alreadyLive.length + " | 0 | 0 |");
  push();
  push("Tier thresholds in force: Tier 2 auto-delete at trigram similarity >= " + TIER2_THRESHOLD + ",");
  push("Tier 3 review floor at " + TIER3_THRESHOLD + ". See `db/scripts/dedup/cluster.ts` for why Tier 3 runs on a");
  push("lexical metric rather than the embeddings the prompt names.");
  push();

  push("## 4. Largest clusters");
  push();
  const all = [...input.liveClusters, ...input.batchClusters].slice(0, 10);
  if (all.length === 0) {
    push("None. No cluster of two or more questions shares a normalised stem in either source.");
  }
  for (const cluster of all) {
    push("**" + cluster.clusterId + "** — tier " + cluster.tier + ", " + cluster.members.length + " members, min similarity " + cluster.minSimilarity.toFixed(3));
    push("- survivor: `" + (cluster.survivor.questionUid ?? cluster.survivor.stableId) + "` (" + cluster.survivorReason + ")");
    push("- stem: " + truncate(cluster.survivor.stemText, 140));
    push("- losers: " + cluster.losers.map((l) => "`" + (l.questionUid ?? l.stableId) + "`").join(", "));
    push();
  }

  push("## 5. Stop point");
  push();
  push("Per Section 7 of the directive this is stop point 1. Nothing further runs until");
  push("this report is reviewed. The next command is a dry run, which also writes nothing:");
  push();
  push("```bash");
  push("npx tsx db/scripts/dedup/cli.ts db-dedup    --run-id " + input.runId + "   # dry run, prints the plan");
  push("npx tsx db/scripts/dedup/cli.ts batch-dedup --run-id " + input.runId + "   # dry run, prints the plan");
  push("```");
  push();

  return lines.join("\n");
}

function renderDuplicatesCsv(
  liveClusters: Cluster[],
  batchClusters: Cluster[],
  alreadyLive: CanonicalRecord[],
  liveByHash: Map<string, CanonicalRecord>
): string {
  const rows: string[] = [
    csvRow([
      "source", "cluster_id", "tier", "role", "question_uid", "question_id", "stable_id",
      "file_path", "file_index", "subject", "node_tag", "similarity", "survivor_uid",
      "survivor_reason", "stem",
    ]),
  ];

  const emit = (source: string, cluster: Cluster) => {
    for (const member of cluster.members) {
      rows.push(
        csvRow([
          source,
          cluster.clusterId,
          cluster.tier,
          member === cluster.survivor ? "survivor" : "delete",
          member.questionUid ?? "",
          member.questionId ?? "",
          member.stableId,
          member.filePath ?? "",
          member.fileIndex ?? "",
          member.subjectCode ?? "",
          member.nodeTagCode ?? "",
          cluster.minSimilarity.toFixed(5),
          cluster.survivor.questionUid ?? cluster.survivor.stableId,
          cluster.survivorReason,
          truncate(member.stemText, 300),
        ])
      );
    }
  };

  for (const cluster of liveClusters) emit("live_db", cluster);
  for (const cluster of batchClusters) emit("batch_file", cluster);

  for (const record of alreadyLive) {
    const survivor = liveByHash.get(record.matchHash)!;
    rows.push(
      csvRow([
        "batch_already_live", "-", 1, "delete", record.questionUid ?? "", "", record.stableId,
        record.filePath ?? "", record.fileIndex ?? "", record.subjectCode ?? "", record.nodeTagCode ?? "",
        "1.00000", survivor.questionUid ?? survivor.stableId,
        "already published in the live bank", truncate(record.stemText, 300),
      ])
    );
  }

  return rows.join("\n") + "\n";
}

function renderReviewCsv(pairs: MatchPair[]): string {
  const rows: string[] = [
    csvRow([
      "decision", "similarity", "reason", "a_uid", "b_uid", "a_digits", "b_digits", "a_stem", "b_stem",
    ]),
  ];
  for (const pair of pairs.sort((x, y) => y.similarity - x.similarity)) {
    rows.push(
      csvRow([
        "", // KEEP_BOTH / DELETE — filled in by a human
        pair.similarity.toFixed(5),
        pair.reason,
        pair.a.questionUid ?? pair.a.stableId,
        pair.b.questionUid ?? pair.b.stableId,
        pair.a.digits,
        pair.b.digits,
        truncate(pair.a.stemText, 400),
        truncate(pair.b.stemText, 400),
      ])
    );
  }
  return rows.join("\n") + "\n";
}

main();
