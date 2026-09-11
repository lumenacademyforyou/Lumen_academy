import fs from "node:fs";
import path from "node:path";
import { QuestionAuthoringSchema } from "../../../schemas/question-authoring.schema.js";
import { pool } from "../../shared/pool.js";
import { TIER2_THRESHOLD, TIER3_THRESHOLD } from "./cluster.js";
import { trigramSimilarity } from "./normalize.js";
import { BANK_ROOT, RunLog, bankPaths, csvRow, parseFlags, sha256HexOfFile, truncate } from "./paths.js";
import { listContentFiles, toRecord } from "./sources/batch.js";
import { loadLiveRecords } from "./sources/db.js";
import type { CanonicalRecord } from "./types.js";

/**
 * Phase 5 — the ingestion gate.
 *
 *   npx tsx db/scripts/dedup/ingest.ts --src db/content/bank/incoming            # dry run
 *   npx tsx db/scripts/dedup/ingest.ts --src db/content/bank/incoming --apply
 *
 * Order of operations, per Section 4 Phase 5:
 *
 *   1. schema validation      — required fields, exactly one correct answer,
 *                               option count in range, no empty/placeholder
 *                               text, no `<<` / TODO / model-preamble leakage.
 *   2. self-dedup             — within the incoming drop.
 *   3. cross-check            — against the live DB and against staged/.
 *   4. route                  — unique -> staged/, tier 1|2 -> rejected/,
 *                               tier 3 -> review_queue.csv.
 *
 * Validation runs FIRST and its failures never reach dedup. A malformed
 * question with an empty stem normalises to the empty string, and every empty
 * stem hashes identically — so validating after dedup would cluster all the
 * broken records together and "resolve" them by deleting all but one.
 */

/**
 * Model-preamble and template leakage. The first three are the prompt's own
 * list. The rest are the artefacts this repo has actually seen: migration
 * 036 (`036_strip_template_artifacts.sql`) exists because generated stems
 * shipped with unresolved `{{placeholder}}` and `[INSERT ...]` markers, and
 * `db/scripts/report-template-family-questions.ts` still tracks 92 flagged
 * rows. This gate is where they should have been stopped.
 */
const LEAKAGE_PATTERNS: [RegExp, string][] = [
  [/<</, "contains '<<' — unfilled template marker"],
  [/\bTODO\b/i, "contains TODO"],
  [/^(sure|certainly|here (is|are)|of course|as an ai)\b/i, "begins with a model preamble"],
  [/\{\{[^}]*\}\}/, "contains an unresolved {{placeholder}}"],
  [/\[(INSERT|PLACEHOLDER|CHAPTER|TOPIC)[^\]]*\]/i, "contains an unresolved [INSERT ...] marker"],
  [/\b(lorem ipsum|xxx+)\b/i, "contains placeholder filler text"],
];

interface Verdict {
  record: CanonicalRecord;
  route: "staged" | "rejected" | "review";
  reasons: string[];
  matchedAgainst?: string;
  similarity?: number;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const log = new RunLog("ingest", flags.runId);
  const paths = bankPaths(typeof flags.raw["bank-root"] === "string" ? flags.raw["bank-root"] : BANK_ROOT);
  const src = typeof flags.raw.src === "string" ? flags.raw.src : paths.incoming;

  try {
    log.say("run_id: " + flags.runId);
    log.say(flags.dryRun ? "DRY RUN — nothing is moved into staged/ or rejected/." : "APPLY — routing files.");
    log.say("source: " + src.replace(/\\/g, "/"));

    if (!fs.existsSync(src)) {
      log.say("");
      log.say("The incoming directory does not exist yet. Create it (or run");
      log.say("`dedup-cli restructure --apply`) and drop new content in as .json or .jsonl.");
      log.say("received: 0 / valid: 0 / duplicates: 0 / staged: 0 / rejected: 0");
      await log.close("ok", { received: 0 });
      return;
    }

    // --- read the drop ------------------------------------------------------
    const incoming: CanonicalRecord[] = [];
    const invalid: Verdict[] = [];
    for (const filePath of listContentFiles(src)) {
      let items: unknown[];
      try {
        items = readItems(filePath);
      } catch (error) {
        log.say("PARSE FAILURE " + filePath + ": " + (error as Error).message, { level: "error" });
        continue;
      }
      items.forEach((item, index) => {
        const record = toRecord(item as never, filePath, index);
        const reasons = validate(item, record);
        if (reasons.length > 0) invalid.push({ record, route: "rejected", reasons });
        else incoming.push(record);
      });
    }

    const received = incoming.length + invalid.length;
    log.say("received: " + received + " (schema-valid: " + incoming.length + ", invalid: " + invalid.length + ")");

    // --- comparison corpus --------------------------------------------------
    const live = await loadLiveRecords({ lifecycleStatus: "published", withReferenceCounts: false });
    const staged = readStaged(paths.staged);
    log.say("comparing against " + live.length + " published + " + staged.length + " already staged");

    const existing = [...live, ...staged];
    const existingByHash = new Map<string, CanonicalRecord>();
    for (const record of existing) if (!existingByHash.has(record.matchHash)) existingByHash.set(record.matchHash, record);

    // --- 2 + 3: self-dedup and cross-check ---------------------------------
    const verdicts: Verdict[] = [...invalid];
    const acceptedByHash = new Map<string, CanonicalRecord>();

    for (const record of incoming) {
      const liveMatch = existingByHash.get(record.matchHash);
      if (liveMatch) {
        verdicts.push({
          record,
          route: "rejected",
          reasons: ["tier 1 — identical normalised stem already exists"],
          matchedAgainst: liveMatch.questionUid ?? liveMatch.questionId ?? "existing",
          similarity: 1,
        });
        continue;
      }

      const selfMatch = acceptedByHash.get(record.matchHash);
      if (selfMatch) {
        verdicts.push({
          record,
          route: "rejected",
          reasons: ["tier 1 — duplicated within this drop"],
          matchedAgainst: (selfMatch.questionUid ?? selfMatch.stableId) + " @ " + (selfMatch.filePath ?? ""),
          similarity: 1,
        });
        continue;
      }

      const near = nearest(record, [...existing, ...acceptedByHash.values()]);
      if (near && near.similarity >= TIER3_THRESHOLD) {
        // The numeric-variant guard applies here exactly as it does in the
        // audit: a high lexical score with a different digit signature is a
        // new numeric variant, which is content we WANT, not a duplicate.
        const sameDigits = near.record.digits === record.digits;
        if (sameDigits && near.similarity >= TIER2_THRESHOLD) {
          verdicts.push({
            record,
            route: "rejected",
            reasons: ["tier 2 — near-identical stem with an identical digit signature"],
            matchedAgainst: near.record.questionUid ?? near.record.stableId,
            similarity: near.similarity,
          });
          continue;
        }
        verdicts.push({
          record,
          route: "review",
          reasons: [
            sameDigits
              ? "tier 3 — paraphrase candidate"
              : "tier 3 — numeric variant (digit signatures differ), never auto-rejected",
          ],
          matchedAgainst: near.record.questionUid ?? near.record.stableId,
          similarity: near.similarity,
        });
        acceptedByHash.set(record.matchHash, record);
        continue;
      }

      verdicts.push({ record, route: "staged", reasons: ["unique"] });
      acceptedByHash.set(record.matchHash, record);
    }

    const stagedOut = verdicts.filter((v) => v.route === "staged");
    const rejected = verdicts.filter((v) => v.route === "rejected");
    const review = verdicts.filter((v) => v.route === "review");
    const duplicates = rejected.filter((v) => v.reasons[0].startsWith("tier"));

    log.writeReport("ingestion_summary.md", renderSummary(flags.runId, src, received, invalid, verdicts, flags.dryRun));
    log.writeReport("review_queue.csv", renderReviewCsv(review));

    if (!flags.dryRun) {
      writeRouted(paths.staged, stagedOut, flags.runId);
      writeRouted(paths.rejected, rejected, flags.runId);
      // Tier 3 stays in incoming/ until a human rules on it. Staging it would
      // push an unreviewed near-duplicate live; rejecting it would discard a
      // legitimate numeric variant. Neither is the tool's call to make.
      log.say("tier-3 items left in " + src.replace(/\\/g, "/") + " pending review_queue.csv decisions");
    }

    log.say("");
    log.say(
      "received: " + received +
      " / valid: " + incoming.length +
      " / duplicates: " + duplicates.length +
      " / staged: " + stagedOut.length +
      " / rejected: " + rejected.length +
      " / review: " + review.length
    );

    if (flags.dryRun) {
      log.say("");
      log.say("STOP POINT 5. Dry run. Re-run with --apply --run-id " + flags.runId + " to route the files.");
    }

    await log.close("ok", {
      received,
      staged: stagedOut.length,
      rejected: rejected.length,
      review: review.length,
    });
  } catch (error) {
    log.say("ingest failed: " + (error as Error).message, { level: "error" });
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function readItems(filePath: string): unknown[] {
  const text = fs.readFileSync(filePath, "utf8");
  if (filePath.toLowerCase().endsWith(".jsonl")) {
    return text.split(/\r?\n/).filter((line) => line.trim().length > 0).map((line) => JSON.parse(line));
  }
  const json = JSON.parse(text);
  if (Array.isArray(json)) return json;
  if (json && Array.isArray(json.questions)) return json.questions;
  return [json];
}

function readStaged(stagedDir: string): CanonicalRecord[] {
  if (!fs.existsSync(stagedDir)) return [];
  const out: CanonicalRecord[] = [];
  for (const filePath of listContentFiles(stagedDir)) {
    try {
      readItems(filePath).forEach((item, index) => out.push(toRecord(item as never, filePath, index)));
    } catch {
      // A staged file that will not parse is a real problem, but it is push's
      // problem — push refuses to run on an unparseable staged tree. Here it
      // only means one fewer thing to compare against, which is safe: the
      // database's UNIQUE index is the backstop either way.
    }
  }
  return out;
}

/** Step 1. Returns an empty array when the record is acceptable. */
export function validate(raw: unknown, record: CanonicalRecord): string[] {
  const reasons: string[] = [];

  const parsed = QuestionAuthoringSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      reasons.push("schema: " + issue.path.join(".") + " " + issue.message);
    }
  }

  // Checks the authoring schema does not make, spelled out because the prompt
  // names them explicitly and because a schema that merely accepts a string
  // will happily accept a placeholder one.
  if (record.stemText.trim().length === 0) reasons.push("stem is empty");
  if (record.stemNorm.length < 10) reasons.push("stem normalises to fewer than 10 characters");

  const isNumeric = record.questionType === "integer" || record.questionType === "numeric";
  if (!isNumeric) {
    const correct = record.options.filter((o) => o.isCorrect);
    if (record.options.length < 2 || record.options.length > 6) {
      reasons.push("option count " + record.options.length + " outside the allowed range 2-6");
    }
    if (correct.length !== 1 && record.questionType !== "multi_choice") {
      reasons.push("expected exactly one correct option, found " + correct.length);
    }
    if (record.options.some((o) => o.text.trim().length === 0)) reasons.push("an option has empty text");
    const texts = record.options.map((o) => o.text.trim().toLowerCase());
    if (new Set(texts).size !== texts.length) reasons.push("two options have the same text");
  } else if (record.numericAnswer == null || record.numericAnswer === "") {
    reasons.push("numeric question has no numericAnswer");
  }

  const haystack = [record.stemText, ...record.options.map((o) => o.text), record.explanation ?? ""].join("\n");
  for (const [pattern, message] of LEAKAGE_PATTERNS) {
    if (pattern.test(haystack)) reasons.push("leakage: " + message);
  }

  return [...new Set(reasons)];
}

function nearest(
  record: CanonicalRecord,
  corpus: CanonicalRecord[]
): { record: CanonicalRecord; similarity: number } | null {
  let best: { record: CanonicalRecord; similarity: number } | null = null;
  for (const other of corpus) {
    const similarity = trigramSimilarity(record.stemNorm, other.stemNorm);
    if (!best || similarity > best.similarity) best = { record: other, similarity };
  }
  return best;
}

function writeRouted(dir: string, verdicts: Verdict[], runId: string): void {
  if (verdicts.length === 0) return;
  fs.mkdirSync(dir, { recursive: true });
  const target = path.join(dir, runId + ".jsonl");
  fs.writeFileSync(
    target,
    verdicts.map((v) => JSON.stringify({ dedupId: v.record.stableId, ...(v.record.raw as object) })).join("\n") + "\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(dir, runId + ".reason.json"),
    JSON.stringify(
      {
        runId,
        count: verdicts.length,
        sha256: sha256HexOfFile(target),
        items: verdicts.map((v) => ({
          dedupId: v.record.stableId,
          questionUid: v.record.questionUid,
          sourceFile: (v.record.filePath ?? "").replace(/\\/g, "/"),
          sourceIndex: v.record.fileIndex,
          reasons: v.reasons,
          matchedAgainst: v.matchedAgainst ?? null,
          similarity: v.similarity ?? null,
        })),
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
}

function renderSummary(
  runId: string,
  src: string,
  received: number,
  invalid: Verdict[],
  verdicts: Verdict[],
  dryRun: boolean
): string {
  const lines: string[] = [];
  const staged = verdicts.filter((v) => v.route === "staged");
  const rejected = verdicts.filter((v) => v.route === "rejected");
  const review = verdicts.filter((v) => v.route === "review");

  lines.push("# ingestion_summary.md");
  lines.push("");
  lines.push("run_id: `" + runId + "`  ");
  lines.push("source: `" + src.replace(/\\/g, "/") + "`  ");
  lines.push("mode: " + (dryRun ? "**dry run** — nothing routed" : "**applied**"));
  lines.push("");
  lines.push("| outcome | count |");
  lines.push("|---|---:|");
  lines.push("| received | " + received + " |");
  lines.push("| failed validation | " + invalid.length + " |");
  lines.push("| duplicates (tier 1/2) | " + (rejected.length - invalid.length) + " |");
  lines.push("| staged | **" + staged.length + "** |");
  lines.push("| rejected | " + rejected.length + " |");
  lines.push("| queued for review (tier 3) | " + review.length + " |");
  lines.push("");

  if (invalid.length > 0) {
    lines.push("## Validation failures");
    lines.push("");
    lines.push("| source | index | reasons |");
    lines.push("|---|---:|---|");
    for (const verdict of invalid.slice(0, 200)) {
      lines.push(
        "| `" + (verdict.record.filePath ?? "").replace(/\\/g, "/") + "` | " + verdict.record.fileIndex +
        " | " + verdict.reasons.join("; ") + " |"
      );
    }
    lines.push("");
  }

  if (rejected.length > invalid.length) {
    lines.push("## Rejected as duplicates");
    lines.push("");
    lines.push("| question_uid | matched | similarity | reason |");
    lines.push("|---|---|---:|---|");
    for (const verdict of rejected.filter((v) => !invalid.includes(v)).slice(0, 200)) {
      lines.push(
        "| `" + (verdict.record.questionUid ?? verdict.record.stableId) + "` | `" + (verdict.matchedAgainst ?? "") +
        "` | " + (verdict.similarity?.toFixed(3) ?? "") + " | " + verdict.reasons.join("; ") + " |"
      );
    }
    lines.push("");
  }

  if (review.length > 0) {
    lines.push("## Queued for review");
    lines.push("");
    lines.push("These were NOT rejected and NOT staged. They stay in `incoming/` until a");
    lines.push("person marks KEEP_BOTH or DELETE in `review_queue.csv`.");
    lines.push("");
    for (const verdict of review.slice(0, 50)) {
      lines.push("- `" + (verdict.record.questionUid ?? verdict.record.stableId) + "` vs `" + verdict.matchedAgainst +
        "` (" + verdict.similarity?.toFixed(3) + ") — " + verdict.reasons.join("; "));
      lines.push("  - " + truncate(verdict.record.stemText, 140));
    }
    lines.push("");
  }

  return lines.join("\n");
}

function renderReviewCsv(review: Verdict[]): string {
  const rows = [csvRow(["decision", "similarity", "reason", "incoming_uid", "matched_against", "incoming_stem"])];
  for (const verdict of review) {
    rows.push(
      csvRow([
        "",
        verdict.similarity?.toFixed(5) ?? "",
        verdict.reasons.join("; "),
        verdict.record.questionUid ?? verdict.record.stableId,
        verdict.matchedAgainst ?? "",
        truncate(verdict.record.stemText, 400),
      ])
    );
  }
  return rows.join("\n") + "\n";
}

main();
