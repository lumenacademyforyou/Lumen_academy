import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * db/scripts/dedup/runlog.ts — run identity, structured JSON logging, and report output.
 *
 * Section 5 of the prompt: "every script takes --dry-run (default on),
 * --limit, --subject, --run-id; is resumable after a kill; and logs
 * structured JSON to reports/<run_id>/."
 */

/**
 * Run output goes to db/reports/dedup/<run_id>/.
 *
 * db/reports/ is where this repo already puts "run artifacts from db/scripts
 * (import runs, prove-*, e2e scripts) — logs of what happened on a given run,
 * not source", and .gitignore already excludes it on exactly that reasoning.
 * Reports embed full question stems and are regenerable by re-running the
 * phase, so they belong there rather than beside the source.
 *
 * Paths are resolved from the process working directory, which every command
 * in db/scripts/dedup/README.md is documented to run from: the repository root.
 */
export const REPORT_ROOT = path.join("db", "reports", "dedup");

export interface CommonFlags {
  dryRun: boolean;
  limit: number | null;
  subject: string | null;
  runId: string;
  /** Phase 2 only: hard delete instead of soft delete, gated on an age window. */
  purge: boolean;
  olderThanDays: number | null;
  /** Phase 6 / Phase 2: how many clusters or rows per transaction. */
  batchSize: number;
  /** Positional / free arguments. */
  rest: string[];
  raw: Record<string, string | boolean>;
}

/**
 * DRY RUN IS THE DEFAULT AND MUST BE OPTED OUT OF EXPLICITLY.
 *
 * `--apply` (or the alias `--execute`) is the only thing that turns writes on.
 * `--dry-run` is accepted for symmetry but is never required. This is the
 * prompt's rule of thumb — "nothing is deleted for real until a dry run has
 * been reviewed and approved" — expressed as a default rather than as a
 * convention someone has to remember.
 */
export function parseFlags(argv: string[]): CommonFlags {
  const raw: Record<string, string | boolean> = {};
  const rest: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      rest.push(arg);
      continue;
    }
    const [key, inlineValue] = arg.slice(2).split(/=(.*)/s);
    if (inlineValue !== undefined) {
      raw[key] = inlineValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      raw[key] = argv[++i];
    } else {
      raw[key] = true;
    }
  }

  const apply = raw.apply === true || raw.execute === true;

  return {
    dryRun: !apply,
    limit: raw.limit ? Number(raw.limit) : null,
    subject: typeof raw.subject === "string" ? raw.subject : null,
    runId: typeof raw["run-id"] === "string" ? raw["run-id"] : crypto.randomUUID(),
    purge: raw.purge === true,
    olderThanDays: parseOlderThan(raw["older-than"]),
    batchSize: raw["batch-size"] ? Number(raw["batch-size"]) : 500,
    rest,
    raw,
  };
}

function parseOlderThan(value: string | boolean | undefined): number | null {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d+)\s*d?$/i);
  return match ? Number(match[1]) : null;
}

export class RunLog {
  readonly runId: string;
  readonly dir: string;
  private readonly stream: fs.WriteStream;
  private readonly startedAt = new Date();

  constructor(readonly phase: string, runId: string) {
    this.runId = runId;
    this.dir = path.join(REPORT_ROOT, runId);
    fs.mkdirSync(this.dir, { recursive: true });
    this.stream = fs.createWriteStream(path.join(this.dir, phase + ".jsonl"), { flags: "a" });
    this.event("run_started", { phase, startedAt: this.startedAt.toISOString() });
  }

  event(type: string, payload: Record<string, unknown> = {}): void {
    this.stream.write(
      JSON.stringify({ ts: new Date().toISOString(), runId: this.runId, phase: this.phase, type, ...payload }) + "\n"
    );
  }

  /** Console + log in one call, so a run's terminal output and its JSONL agree. */
  say(message: string, payload: Record<string, unknown> = {}): void {
    console.log(message);
    this.event("message", { message, ...payload });
  }

  writeReport(fileName: string, contents: string): string {
    const target = path.join(this.dir, fileName);
    fs.writeFileSync(target, contents, "utf8");
    this.event("report_written", { file: target, bytes: Buffer.byteLength(contents) });
    return target;
  }

  async close(status: "ok" | "failed", detail: Record<string, unknown> = {}): Promise<void> {
    this.event("run_finished", {
      status,
      finishedAt: new Date().toISOString(),
      elapsedMs: Date.now() - this.startedAt.getTime(),
      ...detail,
    });
    await new Promise<void>((resolve) => this.stream.end(resolve));
  }
}

/** RFC 4180 CSV escaping — stems contain commas, quotes and newlines. */
export function csvCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

export function truncate(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : flat.slice(0, max - 1) + "…";
}
