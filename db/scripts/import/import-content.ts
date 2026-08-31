import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { pool } from "../../shared/pool.js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";
import { QuestionAuthoringSchema, type QuestionAuthoring } from "../../../schemas/question-authoring.schema.js";
import { uploadAsset } from "../../content/asset-resolver.js";
import { computeContentFp } from "../../shared/normalizeStem.js";

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
  const positional = argv.filter((a) => !a.startsWith("--"));
  const live = argv.includes("--live");
  const assetsDirFlagIndex = argv.indexOf("--assets-dir");
  const assetsDirArg = assetsDirFlagIndex >= 0 ? argv[assetsDirFlagIndex + 1] : undefined;
  const batchFile = positional[0];
  if (!batchFile) {
    console.error("Usage: npx tsx db/scripts/import/import-content.ts <batch.json> [--live] [--assets-dir <dir>]");
    process.exit(1);
  }
  return { batchFile, live, assetsDirArg };
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

async function main() {
  const { batchFile, live, assetsDirArg } = parseArgs(process.argv.slice(2));
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
