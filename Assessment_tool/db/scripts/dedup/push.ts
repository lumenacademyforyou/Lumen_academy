import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import { pool } from "../../shared/pool.js";
import { BANK_ROOT, RunLog, bankPaths, parseFlags, sha256HexOfFile } from "./paths.js";
import { listContentFiles, toRecord } from "./sources/batch.js";
import type { CanonicalRecord } from "./types.js";

/**
 * Phase 6 — push staged content to live, transactionally.
 *
 *   npx tsx db/scripts/dedup/push.ts             # dry run: validates and reports, inserts nothing
 *   npx tsx db/scripts/dedup/push.ts --apply
 *
 * ATOMICITY. The whole push is ONE transaction. This bank's staged drops are
 * in the hundreds, comfortably inside what a single transaction handles, so
 * the chunked path the directive allows as a fallback is not used — chunking
 * would trade a guarantee for throughput this volume does not need. If a drop
 * ever grows past CHUNK_THRESHOLD the run refuses and says so, rather than
 * silently degrading to a weaker guarantee.
 *
 * IDEMPOTENCY IS ENFORCED BY THE DATABASE, NOT BY THIS FILE. Migration 043's
 * `uq_question_match_hash` is a UNIQUE index on the normalised stem hash for
 * published rows, and every insert here is
 * `on conflict (match_hash) where lifecycle_status = 'published' do nothing`.
 * A re-run of the same staged manifest inserts zero rows and still commits.
 * Section 4: "This is the real safety net — application-side checks race,
 * constraints don't."
 *
 * ON FAILURE. ROLLBACK, staged/ untouched, non-zero exit, and the failing
 * record ids printed. The run is safely re-runnable from scratch.
 */

const CHUNK_THRESHOLD = 5000;

interface StagedItem {
  record: CanonicalRecord;
  sourceFile: string;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const log = new RunLog("push", flags.runId);
  const paths = bankPaths(typeof flags.raw["bank-root"] === "string" ? flags.raw["bank-root"] : BANK_ROOT);
  let lockHeld = false;

  try {
    log.say("run_id: " + flags.runId);
    log.say(flags.dryRun ? "DRY RUN — nothing is inserted." : "APPLY — one transaction, all or nothing.");

    if (!fs.existsSync(paths.staged)) {
      log.say("staged/ does not exist — nothing to push. Run `dedup-cli ingest --apply` first.");
      await log.close("ok", { inserted: 0 });
      return;
    }

    const items: StagedItem[] = [];
    for (const filePath of listContentFiles(paths.staged)) {
      const text = fs.readFileSync(filePath, "utf8");
      const parsed = filePath.toLowerCase().endsWith(".jsonl")
        ? text.split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l))
        : (() => {
            const json = JSON.parse(text);
            return Array.isArray(json) ? json : [json];
          })();
      parsed.forEach((item, index) => items.push({ record: toRecord(item, filePath, index), sourceFile: filePath }));
    }

    log.say("staged questions: " + items.length);
    if (items.length === 0) {
      log.say("nothing to push.");
      await log.close("ok", { inserted: 0 });
      return;
    }
    if (items.length > CHUNK_THRESHOLD) {
      log.say(
        "refusing: " + items.length + " staged questions exceeds the " + CHUNK_THRESHOLD +
        "-row single-transaction threshold. Split the drop, or raise CHUNK_THRESHOLD " +
        "deliberately after deciding a partial push is acceptable.",
        { level: "error" }
      );
      await log.close("failed", { reason: "drop too large for one transaction" });
      process.exitCode = 1;
      return;
    }

    const manifestChecksums = listContentFiles(paths.staged).map((f) => ({
      file: path.relative(process.cwd(), f).replace(/\\/g, "/"),
      sha256: sha256HexOfFile(f),
    }));

    const preCount = await countPublished();
    log.say("published rows before: " + preCount);

    if (flags.dryRun) {
      const unresolved = await resolveNodes(items, null);
      log.say("");
      log.say("would insert: " + items.length + " question(s)");
      if (unresolved.length > 0) {
        log.say("BLOCKED — " + unresolved.length + " question(s) name a nodeTagCode that does not exist:", { level: "error" });
        for (const tag of [...new Set(unresolved)].slice(0, 20)) log.say("  " + tag);
      }
      log.say("");
      log.say("STOP POINT 6. Dry run. Re-run with --apply --run-id " + flags.runId + " to push.");
      await log.close("ok", { wouldInsert: items.length, unresolvedNodes: unresolved.length });
      return;
    }

    const lock = await pool.query("select content.fn_try_dedup_lock() as ok");
    lockHeld = Boolean(lock.rows[0]?.ok);
    if (!lockHeld) {
      log.say("another dedup/push run holds the advisory lock; refusing to start.", { level: "error" });
      await log.close("failed", { reason: "advisory lock unavailable" });
      process.exitCode = 1;
      return;
    }

    // Recorded in content.import_batch, which has been this schema's ingestion
    // ledger since the original importer — 43 rows, one per batch file ever
    // loaded, with source_file / file_checksum / row_count / accepted_count /
    // rejected_count / started_at / finished_at and a status CHECK that
    // already allows 'loaded', 'failed' and 'rolled_back'. A push IS an
    // import; giving it a separate table would split "how did content get
    // into this bank" across two places that no query joins.
    //
    // batch_id is the run_id, so every report, log line and ledger row for a
    // run shares one identifier.
    const catalogRes = await pool.query(
      `select (select exam_id from catalog.exam order by exam_code limit 1) as exam_id,
              (select syllabus_version_id from catalog.syllabus_version order by syllabus_version_id limit 1) as syllabus_version_id`
    );
    const { exam_id: examId, syllabus_version_id: syllabusVersionId } = catalogRes.rows[0] as {
      exam_id: string;
      syllabus_version_id: string;
    };

    await pool.query(
      `insert into content.import_batch
         (batch_id, batch_label, exam_id, syllabus_version_id, source_file, file_checksum,
          batch_status, row_count, accepted_count, rejected_count, duplicate_count)
       values ($1, $2, $3, $4, $5, $6, 'loading', $7, 0, 0, 0)
       on conflict (batch_id) do update set started_at = now(), batch_status = 'loading'`,
      [
        flags.runId,
        "dedup-cli push " + flags.runId,
        examId,
        syllabusVersionId,
        JSON.stringify(manifestChecksums),
        manifestChecksums.map((m) => m.sha256).join(","),
        items.length,
      ]
    );

    const client = await pool.connect();
    let inserted = 0;
    let skipped = 0;
    try {
      await client.query("begin");
      await client.query("set transaction isolation level read committed");

      const unresolved = await resolveNodes(items, client);
      if (unresolved.length > 0) {
        throw new Error(
          "unknown nodeTagCode(s): " + [...new Set(unresolved)].join(", ") +
          " — a question cannot be published against a syllabus node that does not exist"
        );
      }

      const jobId = await ensureJob(client, flags.runId);

      for (const item of items) {
        const result = await insertOne(client, item.record, jobId);
        if (result) inserted++;
        else skipped++;
      }

      await client.query("commit");
      log.say("COMMIT — inserted " + inserted + ", skipped as already-present " + skipped);
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      await pool.query(
        `update content.import_batch set batch_status = 'rolled_back', finished_at = now(), detail = $2
          where batch_id = $1`,
        [flags.runId, JSON.stringify({ error: (error as Error).message })]
      );
      log.say("ROLLBACK — " + (error as Error).message, { level: "error" });
      log.say("staged/ is untouched; the run is safe to repeat once the cause is fixed.");
      await log.close("failed", { error: (error as Error).message });
      process.exitCode = 1;
      return;
    } finally {
      client.release();
    }

    // --- post-commit verification -----------------------------------------
    const postCount = await countPublished();
    const dupes = await pool.query(
      `select count(*)::int as n from (
         select match_hash from content.question
          where lifecycle_status = 'published'
          group by match_hash having count(*) > 1) t`
    );
    const duplicateHashes = (dupes.rows[0] as { n: number }).n;
    const countsAgree = postCount === preCount + inserted;

    log.say("");
    log.say("verification");
    log.say("  published before / after : " + preCount + " / " + postCount);
    log.say("  inserted                 : " + inserted);
    log.say("  post == pre + inserted   : " + (countsAgree ? "yes" : "NO"));
    log.say("  duplicate match_hash     : " + duplicateHashes);

    const spotCheck = await pool.query(
      `select question_uid, left(stem_text, 80) as stem
         from content.question
        where job_id = (select job_id from content.ai_generation_job
                         where prompt_version = $1 order by job_id limit 1)
        order by random() limit 10`,
      [flags.runId]
    );
    log.say("  spot check (10 random inserted rows):");
    for (const row of spotCheck.rows as { question_uid: string; stem: string }[]) {
      log.say("    " + row.question_uid + "  " + row.stem);
    }

    await pool.query(
      `update content.import_batch
          set batch_status = 'loaded', finished_at = now(), accepted_count = $2, duplicate_count = $3,
              detail = $4
        where batch_id = $1`,
      [
        flags.runId,
        inserted,
        skipped,
        JSON.stringify({ preCount, postCount, countsAgree, duplicateHashes }),
      ]
    );

    if (!countsAgree || duplicateHashes > 0) {
      log.say("VERIFICATION FAILED — the commit stands, but the counts do not agree.", { level: "error" });
      process.exitCode = 1;
    }

    await log.close(countsAgree && duplicateHashes === 0 ? "ok" : "failed", { inserted, skipped });
  } catch (error) {
    log.say("push failed: " + (error as Error).message, { level: "error" });
    await log.close("failed", { error: (error as Error).message });
    process.exitCode = 1;
  } finally {
    if (lockHeld) await pool.query("select content.fn_release_dedup_lock()");
    await pool.end();
  }
}

async function countPublished(): Promise<number> {
  const res = await pool.query(`select count(*)::int as n from content.question where lifecycle_status = 'published'`);
  return (res.rows[0] as { n: number }).n;
}

const nodeCache = new Map<string, string>();

/** Returns the tag codes that do NOT resolve to a syllabus node. */
async function resolveNodes(items: StagedItem[], client: PoolClient | null): Promise<string[]> {
  const executor = client ?? pool;
  const tags = [...new Set(items.map((i) => i.record.nodeTagCode).filter((t): t is string => Boolean(t)))];
  if (tags.length === 0) return items.map(() => "(missing nodeTagCode)");

  const res = await executor.query(
    `select tag_code, node_id from catalog.syllabus_node where tag_code = any($1::text[])`,
    [tags]
  );
  for (const row of res.rows as { tag_code: string; node_id: string }[]) nodeCache.set(row.tag_code, row.node_id);

  const unresolved: string[] = [];
  for (const item of items) {
    const tag = item.record.nodeTagCode;
    if (!tag) unresolved.push("(missing nodeTagCode)");
    else if (!nodeCache.has(tag)) unresolved.push(tag);
  }
  return unresolved;
}

/**
 * content.question.job_id is NOT NULL and references content.ai_generation_job.
 * One job row per push run, tagged with the run_id in prompt_version so the
 * rows a run inserted can be found again without adding a column.
 */
async function ensureJob(client: PoolClient, runId: string): Promise<string> {
  const existing = await client.query(
    `select job_id from content.ai_generation_job where prompt_version = $1 limit 1`,
    [runId]
  );
  if (existing.rowCount) return (existing.rows[0] as { job_id: string }).job_id;

  const created = await client.query(
    `insert into content.ai_generation_job (job_type, provider_name, model_name, prompt_version, job_status)
     values ('manual_import', 'dedup-cli', 'staged-push', $1, 'completed')
     returning job_id`,
    [runId]
  );
  return (created.rows[0] as { job_id: string }).job_id;
}

/** Returns true when a row was actually inserted, false when ON CONFLICT skipped it. */
async function insertOne(client: PoolClient, record: CanonicalRecord, jobId: string): Promise<boolean> {
  const nodeId = nodeCache.get(record.nodeTagCode ?? "")!;
  const questionUid = record.questionUid ?? (await nextQuestionUid(client, record));
  const isNumeric = record.questionType === "integer" || record.questionType === "numeric";

  const inserted = await client.query(
    `insert into content.question
       (question_uid, primary_node_id, job_id, question_type, difficulty_band, stem_text,
        stem_format, solution_text, solution_format, numeric_answer, lifecycle_status, external_ref)
     values ($1, $2, $3, $4, $5, $6, 'plain', $7, 'plain', $8, 'published', $9)
     on conflict (match_hash) where lifecycle_status = 'published' do nothing
     returning question_id`,
    [
      questionUid,
      nodeId,
      jobId,
      record.questionType,
      record.difficultyBand,
      record.stemText,
      record.explanation,
      isNumeric ? record.numericAnswer : null,
      record.stableId,
    ]
  );

  if (inserted.rowCount === 0) return false;
  const questionId = (inserted.rows[0] as { question_id: string }).question_id;

  for (const [index, option] of record.options.entries()) {
    await client.query(
      `insert into content.question_option (question_id, option_label, option_text, is_correct, display_order)
       values ($1, $2, $3, $4, $5)`,
      [questionId, option.label ?? String.fromCharCode(65 + index), option.text, option.isCorrect, index + 1]
    );
  }

  if (record.explanation) {
    await client.query(
      `insert into content.question_solution (question_id, explanation_text) values ($1, $2)`,
      [questionId, record.explanation]
    );
  }

  await client.query(
    `insert into content.question_node_map (question_id, node_id) values ($1, $2)
     on conflict do nothing`,
    [questionId, nodeId]
  );

  return true;
}

/**
 * `LMN-<SUBJECT>-<NODE>-<6-digit serial>` with the next free serial for that
 * pair, matching schemas/question-authoring.schema.ts.
 *
 * Runs inside the push transaction, so two concurrent pushes cannot both take
 * the same serial: the second blocks on the first's row locks and then reads
 * the committed maximum. The advisory lock makes concurrent pushes impossible
 * anyway; this is the belt to that's braces.
 */
async function nextQuestionUid(client: PoolClient, record: CanonicalRecord): Promise<string> {
  const subject = (record.subjectCode ?? "GEN").toUpperCase();
  const node = (record.nodeTagCode ?? "GEN").toUpperCase().replace(/_/g, "");
  const prefix = "LMN-" + subject + "-" + node + "-";
  const res = await client.query(
    `select coalesce(max(substring(question_uid from '(\\d{6})$')::int), 0) as max_serial
       from content.question where question_uid like $1 || '%'`,
    [prefix]
  );
  const next = Number((res.rows[0] as { max_serial: number }).max_serial) + 1;
  return prefix + String(next).padStart(6, "0");
}

main();
