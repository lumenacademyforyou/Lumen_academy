import type { PoolClient } from "pg";
import { pool } from "../../../shared/pool.js";
import { digitSignature, matchHash, normalizeForMatch, stableQuestionId } from "../normalize.js";
import type { CanonicalRecord, DedupOption } from "../types.js";

/**
 * db/scripts/dedup/sources/db.ts — loads the live bank into CanonicalRecords.
 *
 * Read-only. Nothing in this file writes.
 */

/**
 * Tables whose rows are LIVE HISTORY or LIVE USAGE and must follow the
 * survivor when a duplicate is retired, rather than being left pointing at a
 * soft-deleted row.
 *
 * Derived from the real foreign-key graph, not from a guess — the query that
 * produced it is in db/scripts/dedup/README.md. There are 20 FK edges into
 * content.question; they fall into three groups:
 *
 *   REPOINT (below)  — attempt/test/seen/flashcard history and node tags.
 *                      These describe "this question was used here" and are
 *                      meaningless once the question they name is retired.
 *   OWNED            — question_option / question_solution / question_translation /
 *                      asset / question_source. These are PARTS of the loser
 *                      row. They stay with it: soft delete keeps the parent
 *                      row alive, so they neither dangle nor need moving, and
 *                      the loser stays fully reconstructible for rollback.
 *   BOOKKEEPING      — import_row, asset_rename_log, question_identity_audit,
 *                      question_duplicate_candidate, question_chunk_ref,
 *                      question_review. Records of what happened to THAT row.
 *                      Re-pointing them would falsify history.
 */
export const REPOINT_TABLES = [
  { table: "assess.attempt_question", column: "question_id" },
  { table: "assess.attempt_response", column: "question_id" },
  { table: "assess.test_question", column: "question_id" },
  { table: "assess.user_question_seen", column: "question_id" },
  { table: "content.question_node_map", column: "question_id" },
  { table: "content.question_usage", column: "question_id" },
  { table: "learn.flashcard", column: "question_id" },
] as const;

const LOAD_SQL = `
  select
    q.question_id,
    q.question_uid,
    q.stem_text,
    q.question_type,
    q.difficulty_band,
    q.lifecycle_status,
    q.solution_text,
    q.numeric_answer::text as numeric_answer,
    q.job_id::text        as source_batch,
    s.subject_code,
    n.tag_code            as node_tag_code,
    coalesce(
      (select json_agg(json_build_object(
                'optionId', o.option_id,
                'label',    o.option_label,
                'text',     o.option_text,
                'isCorrect', o.is_correct)
              order by o.display_order)
         from content.question_option o
        where o.question_id = q.question_id),
      '[]'::json) as options
  from content.question q
  left join catalog.syllabus_node n on n.node_id = q.primary_node_id
  left join catalog.subject       s on s.subject_id = n.subject_id
  where ($1::text is null or q.lifecycle_status = $1)
    and ($2::text is null or s.subject_code = $2)
  order by q.question_uid
`;

export interface LoadDbOptions {
  /** Restrict to one lifecycle_status. Defaults to 'published'. */
  lifecycleStatus?: string | null;
  /** --subject filter. */
  subjectCode?: string | null;
  /** --limit. Applied after load so the ordering stays deterministic. */
  limit?: number | null;
  /** Skip the reference-count pass (audit-only callers that never rank survivors). */
  withReferenceCounts?: boolean;
}

export async function loadLiveRecords(
  options: LoadDbOptions = {},
  client?: PoolClient
): Promise<CanonicalRecord[]> {
  const executor = client ?? pool;
  const lifecycle = options.lifecycleStatus === undefined ? "published" : options.lifecycleStatus;
  const result = await executor.query(LOAD_SQL, [lifecycle, options.subjectCode ?? null]);

  const rows = options.limit ? result.rows.slice(0, options.limit) : result.rows;

  const records: CanonicalRecord[] = rows.map((row: any) => {
    const stemNorm = normalizeForMatch(row.stem_text);
    return {
      origin: "db",
      questionId: row.question_id,
      questionUid: row.question_uid,
      stableId: stableQuestionId(row.stem_text),
      stemText: row.stem_text ?? "",
      stemNorm,
      matchHash: matchHash(row.stem_text),
      digits: digitSignature(row.stem_text),
      options: (row.options as DedupOption[]) ?? [],
      questionType: row.question_type,
      difficultyBand: row.difficulty_band,
      subjectCode: row.subject_code,
      nodeTagCode: row.node_tag_code,
      explanation: row.solution_text,
      numericAnswer: row.numeric_answer,
      lifecycleStatus: row.lifecycle_status,
      sourceBatch: row.source_batch,
      // content.question has NO created_at column (verified against
      // information_schema — 32 columns, none temporal). survivor.ts explains
      // what stands in for the prompt's "oldest created_at" rule.
      createdAt: null,
      raw: row,
    };
  });

  if (options.withReferenceCounts !== false) await attachReferenceCounts(records, executor);
  return records;
}

/**
 * Canonical survivor rule 1 — "referenced by other tables ... never orphan
 * live history". One query per re-pointable table, aggregated per question.
 */
export async function attachReferenceCounts(
  records: CanonicalRecord[],
  executor: PoolClient | typeof pool = pool
): Promise<void> {
  const ids = records.map((r) => r.questionId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;

  const counts = new Map<string, number>();
  for (const { table, column } of REPOINT_TABLES) {
    const res = await executor.query(
      `select ${column} as qid, count(*)::int as n from ${table} where ${column} = any($1::uuid[]) group by 1`,
      [ids]
    );
    for (const row of res.rows as { qid: string; n: number }[]) {
      counts.set(row.qid, (counts.get(row.qid) ?? 0) + row.n);
    }
  }

  for (const record of records) {
    record.referenceCount = record.questionId ? counts.get(record.questionId) ?? 0 : 0;
  }
}

/**
 * Reference counts split by whether the reference is ANSWER HISTORY (a
 * student actually responded against this row) or merely a tag/usage row.
 *
 * The distinction is what makes the history-safety gate in db-dedup.ts
 * possible: a question with zero answer history can be re-pointed freely; one
 * with answer history can only be re-pointed if every option a student
 * actually selected has an equivalent on the survivor.
 */
export async function loadAnswerHistoryCounts(
  questionIds: string[],
  executor: PoolClient | typeof pool = pool
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (questionIds.length === 0) return out;
  const res = await executor.query(
    `select question_id as qid, count(*)::int as n
       from assess.attempt_response
      where question_id = any($1::uuid[])
      group by 1`,
    [questionIds]
  );
  for (const row of res.rows as { qid: string; n: number }[]) out.set(row.qid, row.n);
  return out;
}
