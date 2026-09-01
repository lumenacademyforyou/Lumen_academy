import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * dedup-cli — one entry point for every phase, in the order Section 7 runs them.
 *
 *   npx tsx db/scripts/dedup/cli.ts <command> [flags]
 *
 * The chosen command's module is imported, and importing it runs it. One
 * command per invocation, so only one phase ever holds a database connection
 * — which matters here: db/shared/pool.ts draws on a Supabase project budget
 * of 15 session connections shared with the API server.
 */

const COMMANDS: Record<string, { script: string; summary: string; stopPoint: number | null }> = {
  audit: { script: "audit.ts", summary: "Phase 1 — read-only audit of live DB + batch files", stopPoint: 1 },
  "db-dedup": { script: "db-dedup.ts", summary: "Phase 2 — live database dedup (dry run by default)", stopPoint: 2 },
  "batch-dedup": { script: "batch-dedup.ts", summary: "Phase 3 — content batch dedup (dry run by default)", stopPoint: 3 },
  restructure: { script: "restructure.ts", summary: "Phase 4 — folder restructure (dry run by default)", stopPoint: 4 },
  ingest: { script: "ingest.ts", summary: "Phase 5 — ingestion gate for new questions", stopPoint: 5 },
  push: { script: "push.ts", summary: "Phase 6 — push staged content to live, one transaction", stopPoint: 6 },
  rollback: { script: "rollback.ts", summary: "restore everything a given --run-id changed", stopPoint: null },
};

function usage(): void {
  console.log("dedup-cli — question bank deduplication toolkit");
  console.log("");
  console.log("usage: npx tsx db/scripts/dedup/cli.ts <command> [flags]");
  console.log("");
  console.log("commands, in the order Section 7 of the directive runs them:");
  console.log("");
  for (const [name, meta] of Object.entries(COMMANDS)) {
    console.log("  " + name.padEnd(13) + meta.summary);
  }
  console.log("");
  console.log("common flags:");
  console.log("  --apply             perform writes. WITHOUT THIS EVERY COMMAND IS A DRY RUN.");
  console.log("  --run-id <uuid>     reuse a run id so reports from several phases land together");
  console.log("  --limit <n>         cap the number of records considered");
  console.log("  --subject <code>    restrict to one subject (PHY, CHEM, BOT, ZOO)");
  console.log("  --batch-root <dir>  override db/content/content-batches");
  console.log("  --bank-root <dir>   override db/content/bank");
  console.log("");
  console.log("db-dedup only:");
  console.log("  --purge --older-than 30d   hard-delete rows soft-deleted more than 30 days ago");
  console.log("  --batch-size <n>           clusters per transaction group (default 500)");
  console.log("");
  console.log("Reports are written to db/reports/dedup/<run_id>/.");
}

const command = process.argv[2];
const askedForHelp = !command || command === "--help" || command === "-h" || command === "help";

if (askedForHelp || !COMMANDS[command]) {
  // Asking for help is not an error, and must not exit non-zero — a caller
  // that runs `dedup-cli --help` in a script should not see a failure.
  if (!askedForHelp) console.error("unknown command: " + command + "\n");
  usage();
  process.exit(askedForHelp ? 0 : 1);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, COMMANDS[command].script);

// Each phase module parses process.argv itself and calls its own main() on
// import. The command word stays in argv as a positional; parseFlags only
// reads `--`-prefixed arguments, so it is ignored rather than misread.
await import(pathToFileURL(script).href);
