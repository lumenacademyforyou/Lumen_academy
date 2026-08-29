import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../../shared/pool.js";

// docs/neet-tool-fix-prompt.md Task 4a — seeds learn.unit_material from
// db/books/I20_23_Resource_Library_Book_List_REAL.md, the real, Drive-
// verified chapter->unit mapping prepared for exactly this (every file id
// and title in that doc was read live from the connected Drive, per its own
// header — nothing here is invented).
//
// Parses the "## SUBJECT (n units)" / "### `tag_code` — Unit Name" /
// "| `file.pdf` | Real title | [Book Label](drive link) |" structure
// directly out of the markdown rather than hand-transcribing 79 rows into
// TypeScript, since hand-transcription of that many drive_file_ids is
// exactly the kind of task a copy-paste slip silently corrupts.
//
// The doc's own "Gaps found" section (6 chapters with no catalog unit) is
// below the per-unit tables and is never matched by the per-unit table
// regex, so those chapters are correctly excluded by construction — "every
// link must be mapped to exactly one unit; anything that can't be mapped
// does not get added" (Task 4a).
//
// Idempotent: truncates and re-inserts every run rather than diffing,
// since this table has exactly one real data source (this file) and no
// other writer exists yet.

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_MD = path.resolve(SCRIPT_DIR, "..", "..", "books", "I20_23_Resource_Library_Book_List_REAL.md");

interface ParsedRow {
  unitTagCode: string;
  chapterFile: string;
  title: string;
  bookLabel: string;
  driveFileId: string;
}

function extractFileId(driveUrl: string): string | null {
  // Handles /file/d/<ID>/preview (the only form this doc uses) and, for
  // robustness, the other common Drive URL shapes named in Task 4a's own
  // text (?id=<ID>, /open?id=<ID>).
  const m1 = driveUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = driveUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

function parse(markdown: string): ParsedRow[] {
  const lines = markdown.split("\n");
  const rows: ParsedRow[] = [];
  let currentUnitTagCode: string | null = null;
  let inGapsSection = false;

  for (const line of lines) {
    if (/^## Gaps found/i.test(line)) {
      inGapsSection = true;
      currentUnitTagCode = null;
      continue;
    }
    if (inGapsSection) continue; // never map anything after the Gaps section starts

    const unitHeading = line.match(/^### `([a-z0-9_]+)`\s+—/);
    if (unitHeading) {
      currentUnitTagCode = unitHeading[1];
      continue;
    }

    if (!currentUnitTagCode) continue;
    if (/^\|\s*Chapter file\s*\|/.test(line) || /^\|\s*---/.test(line)) continue; // header/separator rows

    const rowMatch = line.match(/^\|\s*`([^`]+\.pdf)`\s*\|\s*([^|]+?)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|\s*$/);
    if (rowMatch) {
      const [, chapterFile, rawTitle, bookLabel, driveUrl] = rowMatch;
      const fileId = extractFileId(driveUrl);
      if (!fileId) {
        console.warn(`skipping row — could not extract a drive_file_id: ${line}`);
        continue;
      }
      // Drop a trailing "*(inferred)*" confidence annotation from the
      // display title — that's a note for this doc's own reviewers, not
      // copy a student should see.
      const title = rawTitle.replace(/\s*\*\(inferred\)\*\s*$/i, "").trim();
      rows.push({ unitTagCode: currentUnitTagCode, chapterFile, title, bookLabel: bookLabel.trim(), driveFileId: fileId });
    }
  }
  return rows;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const markdown = fs.readFileSync(SOURCE_MD, "utf-8");
  const parsed = parse(markdown);

  console.log(`Parsed ${parsed.length} chapter->unit row(s) from ${path.basename(SOURCE_MD)}`);

  const unitTagCodes = [...new Set(parsed.map((r) => r.unitTagCode))];
  const nodesRes = await pool.query<{ node_id: string; tag_code: string }>(
    `select node_id, tag_code from catalog.syllabus_node where tag_code = any($1::text[])`,
    [unitTagCodes]
  );
  const nodeIdByTag = new Map(nodesRes.rows.map((r) => [r.tag_code, r.node_id]));

  const unmapped = unitTagCodes.filter((t) => !nodeIdByTag.has(t));
  if (unmapped.length > 0) {
    console.warn(`WARNING: ${unmapped.length} unit tag_code(s) from the doc have no matching catalog.syllabus_node — their rows are skipped: ${unmapped.join(", ")}`);
  }

  const insertable = parsed.filter((r) => nodeIdByTag.has(r.unitTagCode));
  console.log(`${insertable.length} row(s) resolve to a real catalog unit and will be inserted; ${parsed.length - insertable.length} skipped (unmapped unit).`);

  // sort_order: per unit, in the doc's own listed order (its order already
  // reflects a sensible chapter sequence within the unit).
  const seqByUnit = new Map<string, number>();

  console.log(`\nunit_code   sort  title`);
  for (const r of insertable) {
    const seq = (seqByUnit.get(r.unitTagCode) ?? 0) + 1;
    seqByUnit.set(r.unitTagCode, seq);
    console.log(`${r.unitTagCode.padEnd(10)}  ${String(seq).padStart(2, "0")}    ${r.title} (${r.bookLabel}, ${r.driveFileId})`);
  }

  if (dryRun) {
    console.log("\n--dry-run: no writes made.");
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const del = await client.query(`delete from learn.unit_material`);
    console.log(`\ncleared ${del.rowCount} pre-existing learn.unit_material row(s)`);

    seqByUnit.clear();
    let inserted = 0;
    for (const r of insertable) {
      const seq = (seqByUnit.get(r.unitTagCode) ?? 0) + 1;
      seqByUnit.set(r.unitTagCode, seq);
      const nodeId = nodeIdByTag.get(r.unitTagCode)!;
      await client.query(
        `insert into learn.unit_material (unit_id, title, drive_file_id, mime_type, sort_order, is_active)
         values ($1, $2, $3, 'application/pdf', $4, true)`,
        [nodeId, r.title, r.driveFileId, seq]
      );
      inserted++;
    }
    await client.query("commit");
    console.log(`inserted ${inserted} learn.unit_material row(s) across ${seqByUnit.size} unit(s).`);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }

  await pool.end();
}

main().catch((err) => {
  console.error("05_unit_materials seed failed:", err);
  process.exitCode = 1;
});
