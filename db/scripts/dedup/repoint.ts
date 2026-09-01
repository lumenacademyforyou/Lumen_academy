import type { PoolClient } from "pg";
import { normalizeStem } from "../../shared/normalizeStem.js";
import type { CanonicalRecord } from "./types.js";

/**
 * db/scripts/dedup/repoint.ts — foreign-key re-pointing, and the safety gate that stops
 * it from corrupting answer history.
 *
 * WHY THIS FILE IS LONGER THAN "UPDATE ... SET question_id = survivor"
 * -------------------------------------------------------------------
 * Section 2 of the directive says the stem is the only key: two rows with the
 * same stem are duplicates "even if the options differ, the option order
 * differs, the correct answer differs". Section 3 then says to re-point the
 * loser's foreign keys — including `attempts` — onto the survivor.
 *
 * Those two rules interact badly, and the interaction is silent:
 *
 *   assess.attempt_response stores (question_id, option_id, selected_option_label,
 *   is_correct, marks_awarded). option_id is a foreign key into
 *   content.question_option, and those options belong to the LOSER.
 *
 * Re-point question_id alone and you get a row that says "in this attempt the
 * student answered survivor X, and the option they picked is one that belongs
 * to a different question". Every review screen, every analytics query and
 * every scorecard reading that row is then wrong, with no error anywhere.
 *
 * So re-pointing answer history is allowed only when it can be done
 * faithfully:
 *
 *   1. every option the student actually selected on the loser has an
 *      equivalent option on the survivor (matched on normalised option text),
 *      and option_id / selected_option_label are rewritten to the survivor's;
 *   2. the survivor's correct-answer set is equivalent to the loser's, so the
 *      already-persisted is_correct and marks_awarded stay true;
 *   3. no unique constraint collides — a single attempt or paper that served
 *      BOTH members of a cluster cannot be resolved by re-pointing, because
 *      the result would be one attempt answering the same question twice.
 *
 * A cluster that fails any of these is not deleted. It is escalated to the
 * review queue with the reason attached. That is a deliberate deviation from
 * "the losers are deleted outright": the directive's own Section 3 opens with
 * "never orphan live history", and falsifying history is worse than orphaning
 * it. The escalation is reported, never silent.
 *
 * A cluster whose losers have NO answer history at all skips gates 1 and 2
 * entirely — there is nothing to falsify — and is re-pointed normally. On
 * this bank that is the overwhelming majority.
 */

export interface RepointTableSpec {
  table: string;
  column: string;
  /**
   * Columns that, together with `column`, must stay unique. A loser row whose
   * re-pointed value would collide with an existing survivor row is handled
   * per `onConflict`.
   */
  conflictKeys: string[][];
  /**
   * merge — the collision is benign (a tag or a seen-marker the survivor
   *         already has). Drop the loser's row; the survivor's stands.
   * abort  — the collision is live history. Escalate the whole cluster.
   */
  onConflict: "merge" | "abort";
  /** Primary key columns, recorded in the repoint ledger for rollback. */
  pk: string[];
  /**
   * Extra SQL predicate that EXCLUDES rows from being touched at all. `$1` is
   * the loser's question id. Used where a row is structurally owned by the
   * loser and must not follow the survivor.
   */
  skipWhere?: string;
}

/**
 * Derived from the live constraint catalogue, not from the migration files —
 * `pg_index` was queried directly, because a migration that was edited after
 * being applied would lie and the catalogue cannot.
 */
export const REPOINT_SPECS: RepointTableSpec[] = [
  {
    table: "assess.attempt_question",
    column: "question_id",
    conflictKeys: [["attempt_id"]],
    onConflict: "abort",
    pk: ["attempt_id", "question_id"],
  },
  {
    table: "assess.attempt_response",
    column: "question_id",
    conflictKeys: [["attempt_id"]],
    onConflict: "abort",
    pk: ["response_id"],
  },
  {
    table: "assess.test_question",
    column: "question_id",
    conflictKeys: [["test_section_id"], ["test_id"]],
    onConflict: "abort",
    pk: ["test_question_id"],
  },
  {
    table: "assess.user_question_seen",
    column: "question_id",
    conflictKeys: [["user_id"]],
    onConflict: "merge",
    pk: ["user_id", "question_id"],
  },
  {
    table: "content.question_node_map",
    column: "question_id",
    conflictKeys: [["node_id"]],
    onConflict: "merge",
    pk: ["question_id", "node_id"],
    // THE LOSER'S PRIMARY-NODE ROW MUST NOT MOVE, and the database enforces
    // this rather than merely preferring it. content.question_node_map carries
    // two triggers that were found by running these tests, not by reading the
    // schema:
    //
    //   trg_question_primary_node_sync  — AFTER INSERT/UPDATE on
    //       content.question, auto-creates the map row for primary_node_id.
    //   trg_question_node_map_guard     — BEFORE DELETE on question_node_map,
    //       RAISEs if you delete the row matching the question's
    //       primary_node_id: "change primary_node_id first".
    //
    // Because this toolkit SOFT-deletes, the loser row stays in
    // content.question with its primary_node_id intact — so its primary map
    // row must stay too, or the guard fires and the whole cluster's
    // transaction rolls back. Only the loser's SECONDARY tags move, which is
    // also the semantically right answer: those are the extra syllabus
    // coverage the survivor should inherit.
    skipWhere: "node_id = (select primary_node_id from content.question where question_id = $1)",
  },
  {
    table: "content.question_usage",
    column: "question_id",
    conflictKeys: [["paper_id"]],
    onConflict: "merge",
    pk: ["usage_id"],
  },
  {
    table: "learn.flashcard",
    column: "question_id",
    conflictKeys: [],
    onConflict: "merge",
    pk: ["flashcard_id"],
  },
];

export interface OptionMapping {
  /** loser option_id -> survivor option_id */
  byId: Map<string, string>;
  /** loser option_id -> survivor option_label */
  labelById: Map<string, string>;
}

export interface GateResult {
  ok: boolean;
  /** Present when ok === false — why the cluster cannot be merged. */
  reason?: string;
  optionMapping: OptionMapping;
}

function normalisedCorrectSet(record: CanonicalRecord): string {
  return record.options
    .filter((o) => o.isCorrect)
    .map((o) => normalizeStem(o.text))
    .sort()
    .join("");
}

/**
 * Gates 1 and 2. Called once per (survivor, loser) pair, only when the loser
 * carries answer history.
 */
export function checkHistorySafety(
  survivor: CanonicalRecord,
  loser: CanonicalRecord,
  selectedOptionIds: string[]
): GateResult {
  const byId = new Map<string, string>();
  const labelById = new Map<string, string>();

  const survivorByText = new Map<string, { id: string; label: string }>();
  for (const option of survivor.options) {
    if (!option.optionId) continue;
    const key = normalizeStem(option.text);
    if (!survivorByText.has(key)) {
      survivorByText.set(key, { id: option.optionId, label: option.label ?? "" });
    }
  }

  for (const option of loser.options) {
    if (!option.optionId) continue;
    const match = survivorByText.get(normalizeStem(option.text));
    if (match) {
      byId.set(option.optionId, match.id);
      labelById.set(option.optionId, match.label);
    }
  }

  const unmapped = selectedOptionIds.filter((id) => id && !byId.has(id));
  if (unmapped.length > 0) {
    return {
      ok: false,
      reason:
        "answer history references " + unmapped.length +
        " option(s) on the loser that have no text-equivalent option on the survivor — " +
        "re-pointing would leave a response pointing at another question's option",
      optionMapping: { byId, labelById },
    };
  }

  if (normalisedCorrectSet(survivor) !== normalisedCorrectSet(loser)) {
    return {
      ok: false,
      reason:
        "the survivor and the loser have different correct answers, and the loser has " +
        "already-scored answer history — re-pointing would leave persisted is_correct / " +
        "marks_awarded values that contradict the question they now name",
      optionMapping: { byId, labelById },
    };
  }

  return { ok: true, optionMapping: { byId, labelById } };
}

/** Option ids a student actually selected on this question. */
export async function selectedOptionIdsFor(
  client: PoolClient,
  questionId: string
): Promise<string[]> {
  const res = await client.query(
    `select distinct option_id from assess.attempt_response
      where question_id = $1 and option_id is not null`,
    [questionId]
  );
  return (res.rows as { option_id: string }[]).map((r) => r.option_id);
}

/** Gate 3: would re-pointing violate a unique constraint on a history table? */
export async function findConflicts(
  client: PoolClient,
  spec: RepointTableSpec,
  loserId: string,
  survivorId: string
): Promise<number> {
  if (spec.conflictKeys.length === 0) return 0;
  const skip = spec.skipWhere ? " and not (l." + spec.skipWhere.replace(/\$1/g, "$1") + ")" : "";
  let total = 0;
  for (const key of spec.conflictKeys) {
    const joinPredicate = key.map((col) => "s." + col + " = l." + col).join(" and ");
    const res = await client.query(
      `select count(*)::int as n
         from ${spec.table} l
         join ${spec.table} s on ${joinPredicate} and s.${spec.column} = $2
        where l.${spec.column} = $1${skip}`,
      [loserId, survivorId]
    );
    total += (res.rows[0] as { n: number }).n;
  }
  return total;
}

export interface RepointOutcome {
  table: string;
  moved: number;
  mergedAway: number;
}

/**
 * Move one loser's references onto the survivor. Runs inside the caller's
 * transaction — it opens none of its own, so the caller can roll the whole
 * cluster back as one unit.
 */
export async function repointOne(
  client: PoolClient,
  spec: RepointTableSpec,
  loserId: string,
  survivorId: string,
  runId: string
): Promise<RepointOutcome> {
  let mergedAway = 0;
  const skipAliased = spec.skipWhere ? " and not (l." + spec.skipWhere + ")" : "";
  const skipPlain = spec.skipWhere ? " and not (" + spec.skipWhere + ")" : "";

  if (spec.onConflict === "merge" && spec.conflictKeys.length > 0) {
    for (const key of spec.conflictKeys) {
      const joinPredicate = key.map((col) => "s." + col + " = l." + col).join(" and ");
      const res = await client.query(
        `delete from ${spec.table} l
          where l.${spec.column} = $1${skipAliased}
            and exists (select 1 from ${spec.table} s
                         where ${joinPredicate} and s.${spec.column} = $2)`,
        [loserId, survivorId]
      );
      mergedAway += res.rowCount ?? 0;
    }
  }

  // Ledger first, so a row is never moved without a record of where it came
  // from. Both statements are in the caller's transaction, so if the UPDATE
  // fails the ledger entry disappears with it.
  const pkJson = spec.pk.map((col) => "'" + col + "', " + col).join(", ");
  await client.query(
    `insert into content.question_dedup_repoint (run_id, table_name, column_name, pk_json, from_id, to_id)
     select $3, $4, $5, jsonb_build_object(${pkJson}), $1, $2
       from ${spec.table}
      where ${spec.column} = $1${skipPlain}`,
    [loserId, survivorId, runId, spec.table, spec.column]
  );

  const updated = await client.query(
    `update ${spec.table} set ${spec.column} = $2 where ${spec.column} = $1${skipPlain}`,
    [loserId, survivorId]
  );

  return { table: spec.table, moved: updated.rowCount ?? 0, mergedAway };
}

/**
 * Rewrite the option references a re-pointed response carries, so the row is
 * internally consistent with the survivor it now names. Only called after
 * checkHistorySafety has returned ok.
 */
export async function remapResponseOptions(
  client: PoolClient,
  loserId: string,
  mapping: OptionMapping
): Promise<number> {
  let changed = 0;
  for (const [loserOptionId, survivorOptionId] of mapping.byId) {
    const label = mapping.labelById.get(loserOptionId) ?? null;
    const res = await client.query(
      `update assess.attempt_response
          set option_id = $2, selected_option_label = coalesce($3, selected_option_label)
        where question_id = $1 and option_id = $4`,
      [loserId, survivorOptionId, label, loserOptionId]
    );
    changed += res.rowCount ?? 0;
  }
  return changed;
}
