/**
 * assembleForAttempt — the BLUEPRINT-mode picker (LA-BE-ENGINE-001 TE-P3).
 * Read-only: assembly is a database query (R-1), never a write. One query
 * per blueprint line, run sequentially (not batched into a single round
 * trip) — see LINE_CANDIDATE_SQL's own comment for why: each line must
 * exclude every question already picked by an earlier line in the same
 * paper, which only a sequential pass can guarantee. A second, small query
 * only runs on the exceptional path, when a line came back short, to report
 * an accurate available count in PoolInsufficientError.
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

function generateSeed(): string {
  // 56 bits (7 random bytes) so it always fits a signed bigint column
  // (max 2^63-1) without overflow. The previous version took a full 8 bytes
  // (64 bits) — interpreted as unsigned, that exceeds bigint's signed range
  // roughly half the time, and Postgres rejected the value outright rather
  // than wrapping it, breaking startAttempt intermittently.
  return BigInt(`0x${crypto.randomBytes(7).toString("hex")}`).toString();
}

interface BlueprintLine {
  blueprint_id: string;
  test_section_id: string;
  subject_id: string;
  syllabus_node_id: string | null;
  include_descendants: boolean;
  difficulty_band: string | null;
  question_format: string | null;
  pick_count: number;
}

/**
 * All of a test's blueprint lines, in the order they should be assembled.
 * Ordered by test_section.sequence_no (the same order C5's full-mock
 * section shuffle already commits at test-creation time, and the order the
 * envelope/UI render sections in) so line-processing order is deterministic
 * and matches what a reader of the served paper would expect, not an
 * arbitrary blueprint_id ordering.
 */
const BLUEPRINT_LINES_SQL = `
  select bp.blueprint_id, bp.test_section_id, bp.subject_id, bp.syllabus_node_id,
         bp.include_descendants, bp.difficulty_band, bp.question_format, bp.pick_count
    from assess.test_blueprint bp
    join assess.test_section ts on ts.test_section_id = bp.test_section_id
   where bp.test_id = $1
   order by ts.sequence_no, bp.blueprint_id
`;

/**
 * The candidate-pool query for one blueprint line. Adapted to this schema's
 * real names (docs/DB_STATE.md): content.question_node_map instead of a
 * concept-tree eligibility view (none exists — see docs/OPEN_ITEMS.md),
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
 * tagged to more than one syllabus_node. Without "group by q.question_id"
 * below, a question tagged to two nodes both matching this line's scope
 * would join into two candidate rows and could be picked twice. Aggregating
 * collapses that fan-out before ORDER BY/LIMIT ever see it.
 *
 * Task-2 (docs/neet-tool-fix-prompt.md) — cross-bucket duplicates: the query
 * above (P0-3) only ever prevented one *row-fan-out* source of repeats. The
 * other suspect the fix prompt names is real and was previously unhandled at
 * the source: this is a BLUEPRINT with several lines (e.g. the custom
 * builder letting a student pick two different units of the same subject as
 * two separate lines), and nothing stopped the same question_id from being
 * the top pick in more than one line independently. The old code let that
 * happen and only caught it as a last resort at persistence time
 * (attempt-flow.ts's seenQuestionIds Set), which *silently dropped* the
 * second occurrence — correctly preventing a literal duplicate row, but at
 * the cost of quietly shipping a paper one question short of its requested
 * count, which is exactly what this task's done-when clause forbids
 * ("do not silently ship a short or padded paper").
 *
 * Fixed by assembling lines sequentially instead of in one batched query:
 * each line's candidate query now excludes every question_id already picked
 * by an earlier line in this same paper ($4::uuid[]), so a duplicate can
 * never be selected in the first place — nothing is ever dropped after the
 * fact, and a genuine shortfall (this line's own scope has too few questions
 * even after that exclusion) surfaces as the same structured
 * PoolInsufficientError as before, now computed with the exclusion applied
 * so "available" honestly reflects what's left for this paper. This trades
 * the previous single-round-trip assembly for one query per blueprint line
 * (bounded by the number of lines a test has — a handful even for a
 * multi-unit custom build), which is the only way to make "already used
 * elsewhere in this paper" available to each line's own ORDER BY/LIMIT.
 */
const LINE_CANDIDATE_SQL = `
  select q.question_id
    from content.question q
    join content.question_node_map qnm on qnm.question_id = q.question_id
    join catalog.syllabus_node sn on sn.node_id = qnm.node_id
    left join assess.user_question_seen s on s.user_id = $2 and s.question_id = q.question_id
   where sn.subject_id = $1
     and q.lifecycle_status = 'published'
     and not (q.question_id = any ($4::uuid[]))
     and (
           $5::uuid is null
           or qnm.node_id = $5::uuid
           or (
                $6::boolean
                and sn.node_path like (select target.node_path || '%' from catalog.syllabus_node target where target.node_id = $5::uuid)
              )
         )
     and ($7::text is null or q.difficulty_band = $7::text)
     and ($8::text is null or q.question_type = $8::text)
   group by q.question_id
   order by
     bool_or(s.question_id is not null),
     case when bool_or(s.question_id is not null) = false then md5(q.question_id::text || $3::text) end,
     min(s.last_seen_at)
   limit $9
`;

/** Same filters as LINE_CANDIDATE_SQL, minus the pick_count LIMIT — used only when a line comes back short, to report an honest "available" count. */
const LINE_AVAILABLE_SQL = `
  select count(distinct q.question_id) as available
    from content.question q
    join content.question_node_map qnm on qnm.question_id = q.question_id
    join catalog.syllabus_node sn on sn.node_id = qnm.node_id
   where sn.subject_id = $1
     and q.lifecycle_status = 'published'
     and not (q.question_id = any ($2::uuid[]))
     and (
           $3::uuid is null
           or qnm.node_id = $3::uuid
           or (
                $4::boolean
                and sn.node_path like (select target.node_path || '%' from catalog.syllabus_node target where target.node_id = $3::uuid)
              )
         )
     and ($5::text is null or q.difficulty_band = $5::text)
     and ($6::text is null or q.question_type = $6::text)
`;

/**
 * @throws {PoolInsufficientError} a blueprint line's candidate pool has
 *   fewer questions than its pick_count (after excluding this paper's own
 *   already-picked questions) — names the line and the counts
 */
export async function assembleForAttempt(testId: string, userId: string, seed?: string): Promise<AssembleResult> {
  const generationSeed = seed ?? generateSeed();

  const linesRes = await pool.query<BlueprintLine>(BLUEPRINT_LINES_SQL, [testId]);

  const globallyPicked: string[] = [];
  const sections: AssembledSection[] = [];

  for (const bp of linesRes.rows) {
    const res = await pool.query<{ question_id: string }>(LINE_CANDIDATE_SQL, [
      bp.subject_id,
      userId,
      generationSeed,
      globallyPicked,
      bp.syllabus_node_id,
      bp.include_descendants,
      bp.difficulty_band,
      bp.question_format,
      bp.pick_count,
    ]);
    const questionIds = res.rows.map((r) => r.question_id);

    if (questionIds.length < bp.pick_count) {
      const availableRes = await pool.query<{ available: string }>(LINE_AVAILABLE_SQL, [
        bp.subject_id,
        globallyPicked,
        bp.syllabus_node_id,
        bp.include_descendants,
        bp.difficulty_band,
        bp.question_format,
      ]);
      throw new PoolInsufficientError(bp.blueprint_id, bp.test_section_id, bp.pick_count, Number(availableRes.rows[0].available));
    }

    globallyPicked.push(...questionIds);
    sections.push({ blueprintId: bp.blueprint_id, testSectionId: bp.test_section_id, questionIds });
  }

  return { seed: generationSeed, sections };
}
