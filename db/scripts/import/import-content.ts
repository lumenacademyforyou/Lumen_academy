import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { pool } from "../../shared/pool.js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";
import { QuestionAuthoringSchema, type QuestionAuthoring } from "../../../schemas/question-authoring.schema.js";
import { uploadAsset } from "../../content/asset-resolver.js";
import { computeContentFp } from "../../shared/normalizeStem.js";
import { hasQuestionArtifact } from "../../shared/questionArtifacts.js";

// CL-2 — general-purpose content importer (LA-PLAN-002 Day 1, G3).
// Generalised from db/scripts/seed/02_content.ts: that script migrated one
// fixed legacy array; this one validates and loads any CL-1-shaped batch
// JSON file, tracks the run in content.import_batch/import_row, and never
// writes content.* rows for a row that fails any check.
//
// Usage:
//   npx tsx db/scripts/import/import-content.ts <batch.json> [--live] [--assets-dir <dir>]
//
// Default is DRY RUN (validate + report only, zero writes anywhere,
// including import_batch/import_row). Pass --live to actually import.
// --assets-dir defaults to content-batches/assets/<batch-N> inferred from
// the batch file's own "batch-N" prefix; pass it explicitly if the file
// doesn't follow that naming convention.

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..", "..");
const REPORTS_DIR = path.resolve(REPO_ROOT, "db", "reports");

type RowCategory = "valid" | "schema_error" | "unmapped_node" | "missing_asset" | "duplicate_content";

interface RowReport {
  rowNo: number;
  questionUid: string | null;
  status: RowCategory;
  errors: string[];
  questionId?: string; // set once loaded live
}

interface NodeIndexEntry {
  nodeId: string;
  syllabusVersionId: string;
  subjectId: string;
  subjectCode: string;
  examId: string;
  examCode: string;
}

function parseArgs(argv: string[]) {
  const assetsDirFlagIndex = argv.indexOf("--assets-dir");
  // Guard the -1 case: without --assets-dir the index is -1, and "i !== 0"
  // would otherwise swallow the batch file itself.
  const assetsDirValueIndex = assetsDirFlagIndex >= 0 ? assetsDirFlagIndex + 1 : -1;
  const positional = argv.filter((a, i) => !a.startsWith("--") && i !== assetsDirValueIndex);
  const live = argv.includes("--live");
  const resync = argv.includes("--resync");
  const assetsDirArg = assetsDirFlagIndex >= 0 ? argv[assetsDirFlagIndex + 1] : undefined;
  const batchFile = positional[0];
  if (!batchFile) {
    console.error("Usage: npx tsx db/scripts/import/import-content.ts <batch.json> [--live] [--assets-dir <dir>]");
    console.error("       npx tsx db/scripts/import/import-content.ts <batch.json|dir> --resync [--live]");
    process.exit(1);
  }
  return { batchFile, live, resync, assetsDirArg };
}

function inferAssetsDir(batchFilePath: string): string {
  const base = path.basename(batchFilePath);
  const match = base.match(/^(batch-\d+)/);
  const dirName = match ? match[1] : base.replace(/\.json$/, "");
  return path.resolve(REPO_ROOT, "db", "content", "content-batches", "assets", dirName);
}

async function loadNodeIndex(): Promise<Map<string, NodeIndexEntry>> {
  const res = await pool.query<{
    node_id: string;
    tag_code: string;
    syllabus_version_id: string;
    subject_id: string;
    subject_code: string;
    exam_id: string;
    exam_code: string;
  }>(
    `select sn.node_id, sn.tag_code, sn.syllabus_version_id, sn.subject_id,
            s.subject_code, s.exam_id, e.exam_code
       from catalog.syllabus_node sn
       join catalog.subject s on s.subject_id = sn.subject_id
       join catalog.exam e on e.exam_id = s.exam_id`
  );
  const index = new Map<string, NodeIndexEntry>();
  for (const row of res.rows) {
    index.set(row.tag_code, {
      nodeId: row.node_id,
      syllabusVersionId: row.syllabus_version_id,
      subjectId: row.subject_id,
      subjectCode: row.subject_code,
      examId: row.exam_id,
      examCode: row.exam_code,
    });
  }
  return index;
}

/** Case-sensitive existence check — fs.existsSync alone is case-insensitive on Windows/NTFS. */
function assetFileExists(assetsDir: string, fileName: string): boolean {
  if (!fs.existsSync(assetsDir)) return false;
  const entries = fs.readdirSync(assetsDir);
  return entries.includes(fileName);
}

async function ensureSystemImportUser(): Promise<string> {
  const admin = getSupabaseAdmin();
  const IMPORT_EMAIL = "content-import@lumen.internal";

  const listResult = await admin.auth.admin.listUsers();
  if (listResult.error) throw new Error(`failed to list users: ${listResult.error.message}`);
  const users = listResult.data.users as { id: string; email?: string }[];
  const found = users.find((u) => u.email === IMPORT_EMAIL);
  const authUserId = found
    ? found.id
    : (
        await (async () => {
          const { data: created, error } = await admin.auth.admin.createUser({
            email: IMPORT_EMAIL,
            email_confirm: true,
            user_metadata: { purpose: "content_import_cl2", system: true },
          });
          if (error || !created.user) throw new Error(`failed to create system import user: ${error?.message}`);
          return created.user;
        })()
      ).id;

  const appUserRes = await pool.query<{ user_id: string }>(
    `insert into core.app_user (auth_user_id, email, mobile_number, full_name, user_role, status)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (auth_user_id) do update set auth_user_id = excluded.auth_user_id
     returning user_id`,
    [authUserId, IMPORT_EMAIL, "0000000001", "Content Import System (CL-2)", "system", "active"]
  );
  return appUserRes.rows[0].user_id;
}

// ---------------------------------------------------------------------------
// --resync (docs/latex-rendering-fix-prompt.md, requirement 3)
// ---------------------------------------------------------------------------
//
// Re-running the importer above cannot refresh content that is already in the
// bank, by design and in two independent ways:
//
//   1. DUPLICATE_CONTENT_FP. Every row whose normalized stem+options already
//      exist is rejected outright (Phase 2.4, docs/no-repeat-questions-fix.md).
//      Re-running the loader over new_content today rejects all 1140 rows and
//      writes nothing. That guard is the anti-clone fix and must stay.
//   2. The option reload is `delete from content.question_option` + re-insert,
//      which mints fresh option_ids. assess.attempt_response.option_id
//      references those rows with no ON DELETE clause, so with student answers
//      on the bank (286 rows at the time of writing) the delete raises a
//      foreign-key violation and rolls the whole batch back — and if it ever
//      did succeed it would orphan every historical answer and cascade-delete
//      the option images hanging off content.asset.option_id.
//
// So a *text* fix to already-published questions needs a text refresh, not an
// import. This mode is that refresh, kept inside the same script so there is
// one tool and one parse/validate contract rather than a second parallel
// importer: it matches rows by question_uid, compares field by field, and
// UPDATEs only what actually differs. It never inserts or deletes a question,
// an option or an answer key, and never touches lifecycle_status, option_id,
// display_order, is_correct or content_fp — so attempt history, publication
// state and the dedup index all survive untouched.
//
//   npx tsx db/scripts/import/import-content.ts <file.json|dir> --resync
//   npx tsx db/scripts/import/import-content.ts <file.json|dir> --resync --live
//
// Dry run by default, like the importer proper.

interface ResyncStats {
  questions: number;
  notInBank: string[];
  stemText: number;
  stemFormat: number;
  optionText: number;
  explanationText: number;
  translationStem: number;
  translationOptions: number;
  optionLabelMismatch: string[];
  answerKeyDrift: string[];
  samples: { uid: string; field: string; db: string; file: string }[];
}

function listBatchFiles(target: string): string[] {
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return [target];
  const out: string[] = [];
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory()) out.push(...listBatchFiles(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out.sort();
}

async function resyncFile(filePath: string, live: boolean, stats: ResyncStats) {
  const rows = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  if (!Array.isArray(rows)) throw new Error(`${filePath} is not a JSON array`);

  const parsedRows: QuestionAuthoring[] = [];
  for (const raw of rows) {
    const parsed = QuestionAuthoringSchema.safeParse(raw);
    if (!parsed.success) stats.notInBank.push(`${(raw as { questionUid?: string })?.questionUid ?? "?"} (schema error)`);
    else parsedRows.push(parsed.data);
  }
  if (parsedRows.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Read the whole file's worth of bank state in four queries rather than
    // ~five per question — over a remote pooler the per-question shape turned
    // a 38-file run into thousands of serial round trips.
    const uids = parsedRows.map((q) => q.questionUid);
    const qRes = await client.query<{ question_id: string; question_uid: string; stem_text: string; stem_format: string }>(
      `select question_id, question_uid, stem_text, stem_format from content.question where question_uid = any($1::text[])`,
      [uids]
    );
    const byUid = new Map(qRes.rows.map((r) => [r.question_uid, r]));
    const ids = qRes.rows.map((r) => r.question_id);

    const optRes = await client.query<{ question_id: string; option_label: string; option_text: string; is_correct: boolean }>(
      `select question_id, option_label, option_text, is_correct from content.question_option where question_id = any($1::uuid[])`,
      [ids]
    );
    const optionsByQuestion = new Map<string, Map<string, { option_text: string; is_correct: boolean }>>();
    for (const r of optRes.rows) {
      if (!optionsByQuestion.has(r.question_id)) optionsByQuestion.set(r.question_id, new Map());
      optionsByQuestion.get(r.question_id)!.set(r.option_label, r);
    }

    const solRes = await client.query<{ question_id: string; explanation_text: string }>(
      `select question_id, explanation_text from content.question_solution where question_id = any($1::uuid[])`,
      [ids]
    );
    const solutionByQuestion = new Map(solRes.rows.map((r) => [r.question_id, r.explanation_text]));

    const trRes = await client.query<{ question_id: string; language_code: string; stem_text: string; option_texts: string[] | null }>(
      `select question_id, language_code, stem_text, option_texts from content.question_translation where question_id = any($1::uuid[])`,
      [ids]
    );
    const translationByKey = new Map(trRes.rows.map((r) => [`${r.question_id}:${r.language_code}`, r]));

    for (const q of parsedRows) {
      const dbQuestion = byUid.get(q.questionUid);
      if (!dbQuestion) {
        stats.notInBank.push(q.questionUid);
        continue;
      }
      stats.questions++;
      const questionId = dbQuestion.question_id;

      const note = (field: string, dbVal: string, fileVal: string) => {
        if (stats.samples.length < 10) stats.samples.push({ uid: q.questionUid, field, db: dbVal.slice(0, 150), file: fileVal.slice(0, 150) });
      };

      if (dbQuestion.stem_text !== q.stemText || dbQuestion.stem_format !== q.stemFormat) {
        if (dbQuestion.stem_text !== q.stemText) {
          stats.stemText++;
          note("stemText", dbQuestion.stem_text, q.stemText);
        }
        if (dbQuestion.stem_format !== q.stemFormat) stats.stemFormat++;
        if (live) {
          await client.query(`update content.question set stem_text = $2, stem_format = $3 where question_id = $1`, [questionId, q.stemText, q.stemFormat]);
        }
      }

      // Options are matched on option_label and updated in place, never
      // reloaded, so option_id — and every assess.attempt_response pointing at
      // it — stays valid.
      const dbOptions = optionsByQuestion.get(questionId) ?? new Map();
      for (const opt of q.options ?? []) {
        const dbOpt = dbOptions.get(opt.label);
        if (!dbOpt) {
          stats.optionLabelMismatch.push(`${q.questionUid}:${opt.label} missing in bank`);
          continue;
        }
        // Reported, never written: an answer-key change is not a text re-sync
        // and must not ride along on one.
        if (dbOpt.is_correct !== opt.isCorrect) stats.answerKeyDrift.push(`${q.questionUid}:${opt.label}`);
        if (dbOpt.option_text !== opt.text) {
          stats.optionText++;
          note(`option[${opt.label}]`, dbOpt.option_text, opt.text);
          if (live) {
            await client.query(`update content.question_option set option_text = $3 where question_id = $1 and option_label = $2`, [questionId, opt.label, opt.text]);
          }
        }
      }

      const dbExplanation = solutionByQuestion.get(questionId) ?? null;
      if (dbExplanation !== q.solution.explanationText) {
        stats.explanationText++;
        note("explanationText", dbExplanation ?? "(none)", q.solution.explanationText);
        if (live) {
          await client.query(
            `insert into content.question_solution (question_id, explanation_text, formula_reference)
             values ($1, $2, $3)
             on conflict (question_id) do update set explanation_text = excluded.explanation_text`,
            [questionId, q.solution.explanationText, q.solution.formulaReference ?? null]
          );
        }
      }

      for (const t of q.translations) {
        const dbTr = translationByKey.get(`${questionId}:${t.languageCode}`);
        const fileOptionTexts = t.optionTexts ?? [];
        const stemDiffers = !dbTr || dbTr.stem_text !== t.stemText;
        const optionsDiffer = !dbTr || JSON.stringify(dbTr.option_texts ?? []) !== JSON.stringify(fileOptionTexts);
        if (stemDiffers) {
          stats.translationStem++;
          note(`translation[${t.languageCode}].stemText`, dbTr?.stem_text ?? "(none)", t.stemText);
        }
        if (optionsDiffer) stats.translationOptions++;
        if ((stemDiffers || optionsDiffer) && live) {
          await client.query(
            `insert into content.question_translation (question_id, language_code, stem_text, option_texts, review_status)
             values ($1, $2, $3, $4, 'unreviewed')
             on conflict (question_id, language_code) do update set
               stem_text = excluded.stem_text, option_texts = excluded.option_texts`,
            [questionId, t.languageCode, t.stemText, JSON.stringify(fileOptionTexts)]
          );
        }
      }
    }

    if (live) await client.query("commit");
    else await client.query("rollback");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

async function resyncMain(target: string, live: boolean) {
  const files = listBatchFiles(path.resolve(process.cwd(), target));
  console.log(live ? "--- LIVE RESYNC (text columns only) ---" : "--- DRY RUN RESYNC: no writes will happen ---");
  console.log(`files: ${files.length}`);

  const stats: ResyncStats = {
    questions: 0,
    notInBank: [],
    stemText: 0,
    stemFormat: 0,
    optionText: 0,
    explanationText: 0,
    translationStem: 0,
    translationOptions: 0,
    optionLabelMismatch: [],
    answerKeyDrift: [],
    samples: [],
  };

  for (const file of files) await resyncFile(file, live, stats);

  console.log("\nquestions matched in bank:", stats.questions);
  console.log("fields updated:", {
    stemText: stats.stemText,
    stemFormat: stats.stemFormat,
    optionText: stats.optionText,
    explanationText: stats.explanationText,
    translationStem: stats.translationStem,
    translationOptions: stats.translationOptions,
  });
  if (stats.notInBank.length) console.log(`not in bank (skipped): ${stats.notInBank.length}`, stats.notInBank.slice(0, 10));
  if (stats.optionLabelMismatch.length) console.log(`option label mismatches: ${stats.optionLabelMismatch.length}`, stats.optionLabelMismatch.slice(0, 10));
  if (stats.answerKeyDrift.length) console.log(`ANSWER KEY DRIFT (reported, not written): ${stats.answerKeyDrift.length}`, stats.answerKeyDrift.slice(0, 10));

  if (stats.samples.length) {
    console.log("\nsample changes:");
    for (const s of stats.samples) {
      console.log(`\n  ${s.uid} · ${s.field}`);
      console.log(`    db:   ${s.db}`);
      console.log(`    file: ${s.file}`);
    }
  }
  console.log(live ? "\nresync committed." : "\ndry run complete — rolled back, nothing written. Pass --live to apply.");
  await pool.end();
}

async function main() {
  const { batchFile, live, resync, assetsDirArg } = parseArgs(process.argv.slice(2));
  if (resync) return resyncMain(batchFile, live);
  const batchFilePath = path.resolve(process.cwd(), batchFile);
  const assetsDir = assetsDirArg ? path.resolve(process.cwd(), assetsDirArg) : inferAssetsDir(batchFilePath);

  console.log(live ? "--- LIVE IMPORT ---" : "--- DRY RUN: no writes will happen ---");
  console.log(`batch file:  ${batchFilePath}`);
  console.log(`assets dir:  ${assetsDir}`);

  const raw = fs.readFileSync(batchFilePath, "utf-8");
  const checksum = crypto.createHash("sha256").update(raw).digest("hex");
  const parsedJson = JSON.parse(raw);
  if (!Array.isArray(parsedJson)) {
    console.error("batch file must be a JSON array of questions");
    process.exit(1);
  }

  const nodeIndex = await loadNodeIndex();
  const reports: RowReport[] = [];
  const validRows: { rowNo: number; q: QuestionAuthoring; node: NodeIndexEntry }[] = [];

  // Phase 2.4 (docs/no-repeat-questions-fix.md): reject an incoming row
  // whose content_fp already exists in the bank instead of silently adding
  // another clone — this is the pre-write half of the fix; the collapse
  // migration (031) was the one-time cleanup for what had already leaked
  // in. Checked against every existing content.question row regardless of
  // lifecycle_status (a duplicate of an already-archived clone is still a
  // duplicate), plus every row already accepted earlier in this same batch
  // — two near-simultaneous copies of the same question in one file are
  // exactly the shape of bug that produced the original ~750 clones.
  const existingFpRes = await pool.query<{ fp: string }>(`select encode(content_fp, 'hex') as fp from content.question where content_fp is not null`);
  const seenContentFps = new Set(existingFpRes.rows.map((r) => r.fp));

  parsedJson.forEach((rawRow: unknown, i: number) => {
    const rowNo = i + 1;
    const parsed = QuestionAuthoringSchema.safeParse(rawRow);
    if (!parsed.success) {
      reports.push({
        rowNo,
        questionUid: (rawRow as { questionUid?: string })?.questionUid ?? null,
        status: "schema_error",
        errors: parsed.error.issues.map((iss) => `${iss.path.join(".")}: ${iss.message}`),
      });
      return;
    }
    const q = parsed.data;

    const node = nodeIndex.get(q.nodeTagCode);
    if (!node) {
      reports.push({
        rowNo,
        questionUid: q.questionUid,
        status: "unmapped_node",
        errors: [`nodeTagCode "${q.nodeTagCode}" does not match any live catalog.syllabus_node.tag_code`],
      });
      return;
    }
    const mismatches: string[] = [];
    if (node.subjectCode.toUpperCase() !== q.subjectCode.toUpperCase()) {
      mismatches.push(
        `subjectCode "${q.subjectCode}" does not match the resolved node's subject "${node.subjectCode}"`
      );
    }
    if (node.examCode.toUpperCase() !== q.examCode.toUpperCase()) {
      mismatches.push(`examCode "${q.examCode}" does not match the resolved node's exam "${node.examCode}"`);
    }
    if (mismatches.length > 0) {
      reports.push({ rowNo, questionUid: q.questionUid, status: "schema_error", errors: mismatches });
      return;
    }

    const missingAssets = q.images
      .filter((img) => !assetFileExists(assetsDir, img.fileName))
      .map((img) => `image file not found (case-sensitive): ${path.join(assetsDir, img.fileName)}`);
    if (missingAssets.length > 0) {
      reports.push({ rowNo, questionUid: q.questionUid, status: "missing_asset", errors: missingAssets });
      return;
    }

    // docs/test-engine-fix-prompt.md Defect 1, requirement 4 — the write-time
    // guard, at the import layer. content.question's own trigger
    // (trg_question_reject_artifacts, migration 036) is the real choke point
    // every write path shares; this check exists so a bad batch fails here,
    // naming the row and the offending text, instead of aborting mid-insert
    // on a raw trigger exception with no row context.
    const artifactBearing: string[] = [];
    if (hasQuestionArtifact(q.stemText)) artifactBearing.push(`stemText contains a template/case identifier: ${JSON.stringify(q.stemText.slice(0, 160))}`);
    (q.options ?? []).forEach((o, i) => {
      if (hasQuestionArtifact(o.text)) artifactBearing.push(`option ${i + 1} contains a template/case identifier: ${JSON.stringify(o.text.slice(0, 160))}`);
    });
    (q.translations ?? []).forEach((tr) => {
      if (hasQuestionArtifact(tr.stemText)) artifactBearing.push(`translation "${tr.languageCode}" stemText contains a template/case identifier`);
    });
    if (artifactBearing.length > 0) {
      reports.push({ rowNo, questionUid: q.questionUid, status: "schema_error", errors: artifactBearing });
      return;
    }

    const contentFp = computeContentFp(q.stemText, (q.options ?? []).map((o) => o.text)).toString("hex");
    if (seenContentFps.has(contentFp)) {
      reports.push({
        rowNo,
        questionUid: q.questionUid,
        status: "duplicate_content",
        errors: [`DUPLICATE_CONTENT_FP: normalized stem+options already exist in the bank (content_fp ${contentFp.slice(0, 16)}...)`],
      });
      return;
    }
    seenContentFps.add(contentFp);

    reports.push({ rowNo, questionUid: q.questionUid, status: "valid", errors: [] });
    validRows.push({ rowNo, q, node });
  });

  const summary = {
    total: parsedJson.length,
    valid: reports.filter((r) => r.status === "valid").length,
    schema_error: reports.filter((r) => r.status === "schema_error").length,
    unmapped_node: reports.filter((r) => r.status === "unmapped_node").length,
    missing_asset: reports.filter((r) => r.status === "missing_asset").length,
    duplicate_content: reports.filter((r) => r.status === "duplicate_content").length,
  };
  console.log("\nsummary:", summary);
  if (summary.duplicate_content > 0) {
    console.log(`rejected ${summary.duplicate_content} row(s) as DUPLICATE_CONTENT_FP:`);
    for (const r of reports.filter((r) => r.status === "duplicate_content")) {
      console.log(`  row ${r.rowNo} (${r.questionUid ?? "?"}): ${r.errors.join("; ")}`);
    }
  }

  const distinctSyllabusVersions = new Set(validRows.map((r) => r.node.syllabusVersionId));
  const distinctExams = new Set(validRows.map((r) => r.node.examId));
  if (distinctSyllabusVersions.size > 1 || distinctExams.size > 1) {
    console.error(
      `\nrefusing to proceed: batch resolves to ${distinctExams.size} distinct exam(s) and ` +
        `${distinctSyllabusVersions.size} distinct syllabus_version(s) — content.import_batch is scoped to exactly one of each per batch file.`
    );
    process.exitCode = 1;
  }

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(REPORTS_DIR, `import_${path.basename(batchFilePath, ".json")}_${stamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ batchFile: batchFilePath, checksum, summary, rows: reports }, null, 2));
  console.log(`wrote ${reportPath}`);

  if (!live) {
    console.log("\ndry run complete — no import_batch/import_row/content.* rows written.");
    await pool.end();
    return;
  }

  if (distinctSyllabusVersions.size > 1 || distinctExams.size > 1) {
    await pool.end();
    return;
  }

  if (validRows.length === 0) {
    console.log("\nnothing valid to import — 0 rows passed all checks.");
    await pool.end();
    return;
  }

  const systemUserId = await ensureSystemImportUser();
  const [{ examId, syllabusVersionId }] = validRows.map((r) => ({
    examId: r.node.examId,
    syllabusVersionId: r.node.syllabusVersionId,
  }));

  const client = await pool.connect();
  let batchId: string;
  try {
    await client.query("begin");

    const batchRes = await client.query<{ batch_id: string }>(
      `insert into content.import_batch
         (batch_label, exam_id, syllabus_version_id, source_file, file_checksum, submitted_by, batch_status, row_count)
       values ($1, $2, $3, $4, $5, $6, 'loading', $7)
       on conflict (file_checksum) do update set batch_status = 'loading', started_at = now()
       returning batch_id`,
      [path.basename(batchFilePath), examId, syllabusVersionId, batchFilePath, checksum, systemUserId, parsedJson.length]
    );
    batchId = batchRes.rows[0].batch_id;
    console.log(`\nimport_batch: ${batchId}`);

    const jobRes = await client.query<{ job_id: string }>(
      `insert into content.ai_generation_job (requested_by, job_type, provider_name, job_status)
       values ($1, 'manual_import', 'content_batch_json', 'completed')
       returning job_id`,
      [systemUserId]
    );
    const jobId = jobRes.rows[0].job_id;
    console.log(`ai_generation_job: ${jobId}`);

    let accepted = 0;
    let rejected = 0;

    for (const rep of reports) {
      if (rep.status !== "valid") {
        rejected++;
        await client.query(
          `insert into content.import_row (batch_id, row_no, external_ref, raw_payload, row_status, error_code, error_detail)
           values ($1, $2, $3, $4, 'invalid', $5, $6)
           on conflict (batch_id, row_no) do update set
             row_status = 'invalid', error_code = excluded.error_code, error_detail = excluded.error_detail`,
          [batchId, rep.rowNo, rep.questionUid ?? `row-${rep.rowNo}`, JSON.stringify(parsedJson[rep.rowNo - 1]), rep.status, rep.errors.join("; ")]
        );
        continue;
      }

      const { q, node } = validRows.find((v) => v.rowNo === rep.rowNo)!;

      const questionRes = await client.query<{ question_id: string }>(
        `insert into content.question
           (question_uid, primary_node_id, job_id, question_type, difficulty_band, stem_format, stem_text,
            numeric_answer, answer_tolerance, origin_year, lifecycle_status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft')
         on conflict (question_uid) do update set
           primary_node_id = excluded.primary_node_id, question_type = excluded.question_type,
           difficulty_band = excluded.difficulty_band, stem_format = excluded.stem_format,
           stem_text = excluded.stem_text, numeric_answer = excluded.numeric_answer,
           answer_tolerance = excluded.answer_tolerance, origin_year = excluded.origin_year
         returning question_id`,
        [
          q.questionUid,
          node.nodeId,
          jobId,
          q.questionType,
          q.difficultyBand,
          q.stemFormat,
          q.stemText,
          q.numericAnswer ?? null,
          q.answerTolerance ?? null,
          q.originYear ?? null,
        ]
      );
      const questionId = questionRes.rows[0].question_id;

      await client.query(`delete from content.question_option where question_id = $1`, [questionId]);
      const optionIdByLabel = new Map<string, string>();
      for (let i = 0; i < (q.options ?? []).length; i++) {
        const opt = q.options![i];
        const optRes = await client.query<{ option_id: string }>(
          `insert into content.question_option (question_id, option_label, option_text, is_correct, display_order)
           values ($1, $2, $3, $4, $5)
           returning option_id`,
          [questionId, opt.label, opt.text, opt.isCorrect, i + 1]
        );
        optionIdByLabel.set(opt.label, optRes.rows[0].option_id);
      }

      await client.query(
        `insert into content.question_solution (question_id, explanation_text, formula_reference)
         values ($1, $2, $3)
         on conflict (question_id) do update set
           explanation_text = excluded.explanation_text, formula_reference = excluded.formula_reference`,
        [questionId, q.solution.explanationText, q.solution.formulaReference ?? null]
      );

      for (const t of q.translations) {
        await client.query(
          `insert into content.question_translation (question_id, language_code, stem_text, option_texts, review_status)
           values ($1, $2, $3, $4, 'unreviewed')
           on conflict (question_id, language_code) do update set
             stem_text = excluded.stem_text, option_texts = excluded.option_texts`,
          [questionId, t.languageCode, t.stemText, JSON.stringify(t.optionTexts ?? [])]
        );
      }
      // content.question_node_map's (question_id, primary_node_id) row is
      // written automatically by content.trg_question_primary_node_sync
      // (010_content_rich.sql) on the insert/update above — not duplicated here.

      for (const img of q.images) {
        await uploadAsset({
          localFilePath: path.join(assetsDir, img.fileName),
          questionId,
          optionId: img.targetRole === "option" && img.optionLabel ? optionIdByLabel.get(img.optionLabel) : undefined,
          targetRole: img.targetRole,
          altText: img.altText,
          db: client, // question row is uncommitted — must write via the same transaction client, not the shared pool
        });
      }

      await client.query(
        `insert into content.import_row (batch_id, row_no, external_ref, raw_payload, row_status, question_id)
         values ($1, $2, $3, $4, 'loaded', $5)
         on conflict (batch_id, row_no) do update set row_status = 'loaded', question_id = excluded.question_id`,
        [batchId, rep.rowNo, q.questionUid, JSON.stringify(parsedJson[rep.rowNo - 1]), questionId]
      );
      accepted++;
    }

    await client.query(
      `update content.import_batch set batch_status = $2, accepted_count = $3, rejected_count = $4, finished_at = now()
       where batch_id = $1`,
      [batchId, rejected > 0 && accepted === 0 ? "failed" : "loaded", accepted, rejected]
    );

    await client.query("commit");
    console.log(`\nimport_batch ${batchId}: accepted ${accepted}, rejected ${rejected}`);
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("CL-2 import failed:", err);
  process.exitCode = 1;
});
