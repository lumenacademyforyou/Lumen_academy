import fs from "node:fs";
import path from "node:path";
import { digitSignature, matchHash, normalizeForMatch, stableQuestionId } from "../normalize.js";
import type { CanonicalRecord, DedupOption } from "../types.js";

/**
 * db/scripts/dedup/sources/batch.ts — parses content files into CanonicalRecords with
 * (file_path, index) provenance, so Phase 3 can say exactly which line of
 * which file a removal came from.
 *
 * FORMATS ACCEPTED
 * ----------------
 *   .json   — either a top-level array of questions, or an object with a
 *             `questions` array. Both shapes exist in db/content/content-batches
 *             today, so both are supported rather than one being normalised
 *             away by hand.
 *   .jsonl  — one question per line; this is the Phase 4 target format.
 *
 * Files that fail to parse are reported, not skipped silently: a batch that
 * cannot be read is a batch whose duplicates cannot be found, and swallowing
 * that would make the report a lie.
 */

export interface ParseFailure {
  filePath: string;
  error: string;
}

export interface BatchLoadResult {
  records: CanonicalRecord[];
  failures: ParseFailure[];
  /** file path -> number of questions parsed from it. */
  perFileCounts: Map<string, number>;
}

/** The authoring shape used by db/content/content-batches and schemas/question-authoring.schema.ts. */
interface AuthoredQuestion {
  questionUid?: string;
  subjectCode?: string;
  nodeTagCode?: string;
  questionType?: string;
  difficultyBand?: string;
  stemText?: string;
  numericAnswer?: number | string | null;
  options?: { label?: string; text?: string; isCorrect?: boolean }[];
  solution?: { explanationText?: string };
  [key: string]: unknown;
}

export function listContentFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // _quarantine holds what dedup already removed. Re-reading it would
        // resurrect removals as fresh duplicates on the next run.
        if (entry.name === "_quarantine" || entry.name === "assets" || entry.name === "reports") continue;
        walk(full);
      } else if (/\.(json|jsonl)$/i.test(entry.name)) {
        out.push(full);
      }
    }
  };
  if (fs.existsSync(root)) walk(root);
  return out.sort();
}

export function loadBatchRecords(root: string): BatchLoadResult {
  const records: CanonicalRecord[] = [];
  const failures: ParseFailure[] = [];
  const perFileCounts = new Map<string, number>();

  for (const filePath of listContentFiles(root)) {
    let parsed: AuthoredQuestion[];
    try {
      parsed = parseFile(filePath);
    } catch (error) {
      failures.push({ filePath, error: (error as Error).message });
      continue;
    }
    perFileCounts.set(filePath, parsed.length);
    parsed.forEach((item, index) => {
      records.push(toRecord(item, filePath, index));
    });
  }

  return { records, failures, perFileCounts };
}

function parseFile(filePath: string): AuthoredQuestion[] {
  const text = fs.readFileSync(filePath, "utf8");
  if (filePath.toLowerCase().endsWith(".jsonl")) {
    return text
      .split(/\r?\n/)
      .map((line, i) => ({ line: line.trim(), i }))
      .filter((entry) => entry.line.length > 0)
      .map((entry) => {
        try {
          return JSON.parse(entry.line) as AuthoredQuestion;
        } catch (error) {
          throw new Error(`line ${entry.i + 1}: ${(error as Error).message}`);
        }
      });
  }
  const json = JSON.parse(text);
  if (Array.isArray(json)) return json as AuthoredQuestion[];
  if (json && Array.isArray(json.questions)) return json.questions as AuthoredQuestion[];
  throw new Error("expected a top-level array or an object with a `questions` array");
}

export function toRecord(item: AuthoredQuestion, filePath: string, index: number): CanonicalRecord {
  const stemText = typeof item.stemText === "string" ? item.stemText : "";
  const options: DedupOption[] = (item.options ?? []).map((o) => ({
    label: o.label ?? null,
    text: o.text ?? "",
    isCorrect: Boolean(o.isCorrect),
    optionId: null,
  }));

  return {
    origin: "file",
    questionId: null,
    questionUid: item.questionUid ?? null,
    stableId: stableQuestionId(stemText),
    stemText,
    stemNorm: normalizeForMatch(stemText),
    matchHash: matchHash(stemText),
    digits: digitSignature(stemText),
    options,
    questionType: item.questionType ?? null,
    difficultyBand: item.difficultyBand ?? null,
    subjectCode: item.subjectCode ?? null,
    nodeTagCode: item.nodeTagCode ?? null,
    explanation: item.solution?.explanationText ?? null,
    numericAnswer: item.numericAnswer == null ? null : String(item.numericAnswer),
    lifecycleStatus: null,
    // The batch a file question came from IS its file — there is no
    // source_batch field in the authoring contract. Using the path keeps the
    // prompt's "per-source_batch breakdown (identifies which generation runs
    // drifted)" answerable for file-side records too.
    sourceBatch: filePath,
    createdAt: null,
    filePath,
    fileIndex: index,
    raw: item,
  };
}
