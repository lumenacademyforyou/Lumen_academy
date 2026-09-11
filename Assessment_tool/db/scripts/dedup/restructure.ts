import fs from "node:fs";
import path from "node:path";
import { pool } from "../../shared/pool.js";
import { BANK_ROOT, LEGACY_BATCH_ROOT, RunLog, bankPaths, parseFlags, sha256HexOfFile } from "./paths.js";
import { slugify, stableQuestionId } from "./normalize.js";
import { loadBatchRecords } from "./sources/batch.js";
import { loadLiveRecords } from "./sources/db.js";
import type { CanonicalRecord } from "./types.js";

/**
 * Phase 4 — folder restructure.
 *
 *   npx tsx db/scripts/dedup/restructure.ts            # dry run: prints the before/after tree
 *   npx tsx db/scripts/dedup/restructure.ts --apply    # builds the tree and MOVES batch files in
 *
 * Target layout (Section 4, Phase 4), rooted at db/content/bank:
 *
 *   bank/
 *     live/                        mirror of what is published, read-only reference
 *     batches/<subject>/<topic>/<batch_id>.jsonl
 *     incoming/                    new, unverified drops land here
 *     staged/                      passed dedup + validation, awaiting push
 *     rejected/                    failed validation, with a .reason.json alongside
 *     _quarantine/<run_id>/        everything dedup removed, recoverable
 *     manifests/<batch_id>.json    counts, checksum, source, generated_at, model, run_id
 *     reports/
 *
 * WHAT MOVES AND WHAT DOES NOT
 * ----------------------------
 * Question files MOVE out of db/content/content-batches into bank/batches.
 * `db/content/content-batches/assets/` stays exactly where it is: the images
 * are referenced by db/scripts/import/import-content.ts, which infers the
 * assets directory from the batch file's own name, and moving them would
 * break an importer this pass was not asked to touch. Every manifest records
 * the assets directory its batch needs, so the importer can be handed
 * `--assets-dir` explicitly instead of inferring it.
 *
 * One question per JSONL line. Stable `question_id` (uuid v5 over the
 * normalised match key) is written into each line as `dedupId`, so the same
 * question always carries the same id no matter which file it lands in.
 */

interface PlannedFile {
  from: string;
  to: string;
  batchId: string;
  subject: string;
  topic: string;
  count: number;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const log = new RunLog("restructure", flags.runId);

  try {
    log.say("run_id: " + flags.runId);
    log.say(flags.dryRun ? "DRY RUN — no directory is created and no file is moved." : "APPLY — building the tree.");

    const paths = bankPaths(BANK_ROOT);
    const batch = loadBatchRecords(LEGACY_BATCH_ROOT);
    if (batch.failures.length > 0) {
      for (const failure of batch.failures) log.say("PARSE FAILURE " + failure.filePath + ": " + failure.error);
      log.say("Refusing to restructure a tree that does not fully parse.");
      await log.close("failed", { parseFailures: batch.failures.length });
      process.exitCode = 1;
      return;
    }

    const byFile = new Map<string, CanonicalRecord[]>();
    for (const record of batch.records) {
      const key = record.filePath!;
      const list = byFile.get(key);
      if (list) list.push(record);
      else byFile.set(key, [record]);
    }

    const planned: PlannedFile[] = [];
    for (const [filePath, records] of [...byFile].sort((a, b) => a[0].localeCompare(b[0]))) {
      const subject = slugify(dominant(records.map((r) => r.subjectCode)) ?? "unsorted");
      const topic = slugify(dominant(records.map((r) => r.nodeTagCode)) ?? "mixed");
      const batchId = slugify(path.basename(filePath).replace(/\.(json|jsonl)$/i, ""));
      planned.push({
        from: filePath,
        to: path.join(paths.batches, subject, topic, batchId + ".jsonl"),
        batchId,
        subject,
        topic,
        count: records.length,
      });
    }

    const tree = renderTree(planned);
    log.say("");
    log.say(tree);

    if (flags.dryRun) {
      log.writeReport("restructure_plan.md", renderPlan(flags.runId, planned, tree, true));
      log.say("");
      log.say("STOP POINT 4. Dry run. Re-run with --apply --run-id " + flags.runId + " to build it.");
      await log.close("ok", { files: planned.length, applied: false });
      return;
    }

    for (const dir of Object.values(paths)) fs.mkdirSync(dir, { recursive: true });
    writeReadme(paths);

    // --- move the batch files ---------------------------------------------
    for (const plan of planned) {
      const records = byFile.get(plan.from)!;
      fs.mkdirSync(path.dirname(plan.to), { recursive: true });

      const lines = records
        .sort((a, b) => (a.fileIndex ?? 0) - (b.fileIndex ?? 0))
        .map((record) =>
          JSON.stringify({ dedupId: stableQuestionId(record.stemText), ...(record.raw as object) })
        );
      fs.writeFileSync(plan.to, lines.join("\n") + "\n", "utf8");

      // The original is removed only after its replacement is on disk, so an
      // interrupted run leaves a duplicate rather than a hole.
      fs.rmSync(plan.from);

      const assetsDir = path.join(LEGACY_BATCH_ROOT, "assets");
      fs.writeFileSync(
        path.join(paths.manifests, plan.batchId + ".json"),
        JSON.stringify(
          {
            batchId: plan.batchId,
            subject: plan.subject,
            topic: plan.topic,
            file: path.relative(BANK_ROOT, plan.to).replace(/\\/g, "/"),
            count: records.length,
            sha256: sha256HexOfFile(plan.to),
            source: path.relative(process.cwd(), plan.from).replace(/\\/g, "/"),
            // The generator is not recorded anywhere in the authoring files,
            // so it is reported as unknown rather than guessed. Fill it in at
            // generation time for future batches.
            model: null,
            generatedAt: null,
            restructuredAt: new Date().toISOString(),
            runId: flags.runId,
            assetsDir: path.relative(process.cwd(), assetsDir).replace(/\\/g, "/"),
          },
          null,
          2
        ) + "\n",
        "utf8"
      );
    }
    log.say("moved " + planned.length + " batch file(s) into " + paths.batches.replace(/\\/g, "/"));

    // --- live/ mirror -------------------------------------------------------
    const live = await loadLiveRecords({ lifecycleStatus: "published", withReferenceCounts: false });
    const liveBySubject = new Map<string, CanonicalRecord[]>();
    for (const record of live) {
      const key = slugify(record.subjectCode ?? "unsorted");
      const list = liveBySubject.get(key);
      if (list) list.push(record);
      else liveBySubject.set(key, [record]);
    }
    for (const [subject, records] of liveBySubject) {
      const target = path.join(paths.live, subject + ".jsonl");
      const lines = records.map((record) =>
        JSON.stringify({
          dedupId: record.stableId,
          questionId: record.questionId,
          questionUid: record.questionUid,
          subjectCode: record.subjectCode,
          nodeTagCode: record.nodeTagCode,
          questionType: record.questionType,
          difficultyBand: record.difficultyBand,
          stemText: record.stemText,
          options: record.options.map((o) => ({ label: o.label, text: o.text, isCorrect: o.isCorrect })),
        })
      );
      fs.writeFileSync(target, lines.join("\n") + "\n", "utf8");
    }
    log.say("wrote live/ mirror: " + liveBySubject.size + " file(s), " + live.length + " published questions");

    log.writeReport("restructure_plan.md", renderPlan(flags.runId, planned, renderTree(planned), false));
    await log.close("ok", { files: planned.length, applied: true });
  } catch (error) {
    log.say("restructure failed: " + (error as Error).message, { level: "error" });
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function dominant(values: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function renderTree(planned: PlannedFile[]): string {
  const lines: string[] = [];
  lines.push(path.relative(process.cwd(), BANK_ROOT).replace(/\\/g, "/") + "/");
  lines.push("  live/                      " + "one .jsonl per subject, mirrors published rows");
  lines.push("  batches/");
  const bySubject = new Map<string, Map<string, PlannedFile[]>>();
  for (const plan of planned) {
    const topics = bySubject.get(plan.subject) ?? new Map<string, PlannedFile[]>();
    const files = topics.get(plan.topic) ?? [];
    files.push(plan);
    topics.set(plan.topic, files);
    bySubject.set(plan.subject, topics);
  }
  for (const [subject, topics] of [...bySubject].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push("    " + subject + "/");
    for (const [topic, files] of [...topics].sort((a, b) => a[0].localeCompare(b[0]))) {
      lines.push("      " + topic + "/");
      for (const file of files) {
        lines.push("        " + path.basename(file.to) + "   (" + file.count + " questions)");
      }
    }
  }
  lines.push("  incoming/                  new, unverified drops");
  lines.push("  staged/                    passed dedup + validation, awaiting push");
  lines.push("  rejected/                  failed validation, .reason.json alongside");
  lines.push("  _quarantine/<run_id>/      everything dedup removed, recoverable");
  lines.push("  manifests/<batch_id>.json  counts, sha256, source, run_id, assetsDir");
  lines.push("  reports/");
  return lines.join("\n");
}

function renderPlan(runId: string, planned: PlannedFile[], tree: string, dryRun: boolean): string {
  const lines: string[] = [];
  lines.push("# restructure_plan.md");
  lines.push("");
  lines.push("run_id: `" + runId + "`  ");
  lines.push("mode: " + (dryRun ? "**dry run** — nothing moved" : "**applied**"));
  lines.push("");
  lines.push("## Before");
  lines.push("");
  lines.push("```");
  lines.push(LEGACY_BATCH_ROOT.replace(/\\/g, "/") + "/");
  lines.push("  <Subject>/<file>.json         one JSON array per file, mixed naming");
  lines.push("  assets/batch-N/*.png          stays in place — see restructure.ts header");
  lines.push("```");
  lines.push("");
  lines.push("## After");
  lines.push("");
  lines.push("```");
  lines.push(tree);
  lines.push("```");
  lines.push("");
  lines.push("## File moves");
  lines.push("");
  lines.push("| from | to | questions |");
  lines.push("|---|---|---:|");
  for (const plan of planned) {
    lines.push(
      "| `" + path.relative(process.cwd(), plan.from).replace(/\\/g, "/") + "` | `" +
      path.relative(process.cwd(), plan.to).replace(/\\/g, "/") + "` | " + plan.count + " |"
    );
  }
  lines.push("");
  return lines.join("\n");
}

function writeReadme(paths: ReturnType<typeof bankPaths>): void {
  const notes: [string, string][] = [
    [paths.live, "Read-only mirror of the published bank. Regenerated by `dedup-cli restructure --apply`. Never edit by hand and never import from here — the database is the source of truth for these."],
    [paths.incoming, "Drop new generated content here. Nothing in this directory has been validated or dedup-checked. `dedup-cli ingest` empties it into staged/ or rejected/."],
    [paths.staged, "Passed schema validation and all three dedup tiers. `dedup-cli push` inserts from here and from nowhere else."],
    [paths.rejected, "Failed validation or matched an existing question. Each rejected file has a .reason.json beside it saying which rule fired."],
  ];
  for (const [dir, text] of notes) {
    const target = path.join(dir, "README.md");
    if (!fs.existsSync(target)) fs.writeFileSync(target, "# " + path.basename(dir) + "\n\n" + text + "\n", "utf8");
  }
}

main();
