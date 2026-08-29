/**
 * assembleForAttempt — the BLUEPRINT-mode picker (LA-BE-ENGINE-001 TE-P3).
 * Read-only: assembly is a database query (R-1), never a write. One round
 * trip for the candidate-pool query regardless of how many blueprint lines
 * the test has (a second, small query only runs on the exceptional path,
 * when a line came back short, to report accurate requested/available
 * counts in PoolInsufficientError).
 *
 * Persisting the resulting picks and the seed onto a real attempt is TE-P4's
 * job (startAttempt) — this function doesn't know about assess.attempt at
 * all. It also doesn't yet have anywhere per-attempt to persist a served
 * set even if it wanted to: this schema has no attempt-scoped
 * "served question" table (unlike the Prisma track's public.attempt_
 * questions) — assess.test_question is scoped to the whole test, not one
 * attempt, so it cannot hold a per-attempt BLUEPRINT pick. Flagged here for
 * TE-P4, not solved in this phase.
 */
import crypto from "node:crypto";
import { pool } from "../../../shared/pool.js";
import { PoolInsufficientError } from "../../../shared/errors.js";

export interface AssembledSection {
  blueprintId: string;
  testSectionId: string;
  questionIds: string[]; // in the seeded random order — persisted order is the caller's job
}

export interface AssembleResult {
  seed: string; // bigint as string — never number, matches R-11's NUMERIC discipline for anything persisted
  sections: AssembledSection[];
}

interface CandidateRow {
  blueprint_id: string;
  test_section_id: string;
  pick_count: number;
  question_id: string;
}

function generateSeed(): string {
  // 56 bits (7 random bytes) so it always fits a signed bigint column
  // (max 2^63-1) without overflow. The previous version took a full 8 bytes
  // (64 bits) — interpreted as unsigned, that exceeds bigint's signed range
  // roughly half the time, and Postgres rejected the value outright rather
  // than wrapping it, breaking startAttempt intermittently.
  return BigInt(`0x${crypto.randomBytes(7).toString("hex")}`).toString();
}

/**
 * The candidate-pool query — one LATERAL subquery per blueprint row,
 * executed as a single statement for the whole test. Adapted to this
 * schema's real names (docs/DB_STATE.md): content.question_node_map instead
 * of a concept-tree eligibility view (none exists — see docs/OPEN_ITEMS.md),
 * catalog.syllabus_node.node_path (plain text with a trigram index, not
 * ltree) for the include_descendants match.
 *
 * D-2 exposure preference (LA-APP-COMPLETION-001 Phase C, C4): never a hard
 * exclusion — a student is never told "insufficient pool" just because every
 * remaining question happens to be one they've seen before. Unseen questions
 * (no assess.user_question_seen row) sort first, in the seeded shuffle order;
 * once those run out, previously-seen questions fill the rest, oldest
 * last_seen_at first (true least-recently-seen), only reached when the
 * unseen pool for this blueprint line is exhausted.
 *
 * P0-3 (docs/assessment-tool-fix-prompt.md): content.question_node_map's PK
 * is (question_id, node_id), not (question_id) — a question CAN legally be
 * tagged to more than one syllabus_node (the current import pipeline only
 * ever writes one row per question via a DB trigger, but nothing enforces
 * that as an invariant). Without the "group by q.question_id" below, a
 * question tagged to two nodes both matching this blueprint line's scope
 * would join into two candidate rows and could be picked twice — the exact
 * "de-duplicated at the point of paper generation" defect this item calls
 * out. Aggregating collapses that fan-out before ORDER BY/LIMIT ever see it;
 * the left-joined user_question_seen row is already at most one per
 * question_id, so bool_or/min are just how you carry a single-row value
 * through a GROUP BY, not a real aggregation.
 */
const CANDIDATE_POOL_SQL = `
  select bp.blueprint_id, bp.test_section_id, bp.pick_count, picked.question_id
    from assess.test_blueprint bp
    cross join lateral (
      select q.question_id
        from content.question q
        join content.question_node_map qnm on qnm.question_id = q.question_id
        join catalog.syllabus_node sn on sn.node_id = qnm.node_id
        left join assess.user_question_seen s on s.user_id = $2 and s.question_id = q.question_id
       where sn.subject_id = bp.subject_id
         and q.lifecycle_status = 'published'
         and (
               bp.syllabus_node_id is null
               or qnm.node_id = bp.syllabus_node_id
               or (
                    bp.include_descendants
                    and sn.node_path like (select target.node_path || '%' from catalog.syllabus_node target where target.node_id = bp.syllabus_node_id)
                  )
             )
         and (bp.difficulty_band is null or q.difficulty_band = bp.difficulty_band)
         and (bp.question_format is null or q.question_type = bp.question_format)
       group by q.question_id
       order by
         bool_or(s.question_id is not null),
         case when bool_or(s.question_id is not null) = false then md5(q.question_id::text || $3::text) end,
         min(s.last_seen_at)
       limit bp.pick_count
    ) picked
   where bp.test_id = $1
`;

/**
 * @throws {PoolInsufficientError} a blueprint line's candidate pool has
 *   fewer questions than its pick_count — names the line and the counts
 */
export async function assembleForAttempt(testId: string, userId: string, seed?: string): Promise<AssembleResult> {
  const generationSeed = seed ?? generateSeed();

  const res = await pool.query<CandidateRow>(CANDIDATE_POOL_SQL, [testId, userId, generationSeed]);

  const byBlueprint = new Map<string, { testSectionId: string; pickCount: number; questionIds: string[] }>();
  for (const row of res.rows) {
    const entry = byBlueprint.get(row.blueprint_id) ?? { testSectionId: row.test_section_id, pickCount: row.pick_count, questionIds: [] };
    entry.questionIds.push(row.question_id);
    byBlueprint.set(row.blueprint_id, entry);
  }

  // Blueprint lines with zero rows never appear as a key above (the LATERAL
  // produces no rows for them) — fetch the test's full blueprint list to
  // catch that case too, not just the "came back short" case.
  const allBlueprintsRes = await pool.query<{ blueprint_id: string; test_section_id: string; pick_count: number }>(
    `select blueprint_id, test_section_id, pick_count from assess.test_blueprint where test_id = $1`,
    [testId]
  );

  for (const bp of allBlueprintsRes.rows) {
    const entry = byBlueprint.get(bp.blueprint_id);
    const picked = entry?.questionIds.length ?? 0;
    if (picked < bp.pick_count) {
      // No seen-status exclusion here: since the candidate query above only
      // deprioritizes seen questions rather than excluding them, "available"
      // is the raw filtered pool size, regardless of exposure history.
      const availableRes = await pool.query<{ available: string }>(
        `select count(distinct q.question_id) as available
           from content.question q
           join content.question_node_map qnm on qnm.question_id = q.question_id
           join catalog.syllabus_node sn on sn.node_id = qnm.node_id
           join assess.test_blueprint bp on bp.blueprint_id = $1
          where sn.subject_id = bp.subject_id
            and q.lifecycle_status = 'published'
            and (
                  bp.syllabus_node_id is null
                  or qnm.node_id = bp.syllabus_node_id
                  or (bp.include_descendants and sn.node_path like (select target.node_path || '%' from catalog.syllabus_node target where target.node_id = bp.syllabus_node_id))
                )
            and (bp.difficulty_band is null or q.difficulty_band = bp.difficulty_band)
            and (bp.question_format is null or q.question_type = bp.question_format)`,
        [bp.blueprint_id]
      );
      throw new PoolInsufficientError(bp.blueprint_id, bp.test_section_id, bp.pick_count, Number(availableRes.rows[0].available));
    }
  }

  return {
    seed: generationSeed,
    sections: allBlueprintsRes.rows.map((bp) => ({
      blueprintId: bp.blueprint_id,
      testSectionId: bp.test_section_id,
      questionIds: byBlueprint.get(bp.blueprint_id)!.questionIds,
    })),
  };
}
