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
import { PoolInsufficientError, AssemblerDuplicateAssertionError } from "../../../shared/errors.js";

export interface AssembledSection {
  blueprintId: string;
  testSectionId: string;
  questionIds: string[]; // in the seeded random order — persisted order is the caller's job
  contentFps: string[]; // hex, same order/index as questionIds — Phase 4.3's attempt-flow.ts dedup key
  subjectId: string; // Phase 5: for attempt-flow.ts's per-unit recycle log, without a second query
  syllabusNodeId: string | null;
  recycledCount: number; // Phase 5: how many of this line's picks were already in assess.user_question_seen before this attempt
}

export interface AssembleResult {
  seed: string; // bigint as string — never number, matches R-11's NUMERIC discipline for anything persisted
  sections: AssembledSection[];
  recycledCount: number; // Phase 5: sum of every section's recycledCount
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
  has_image_only: boolean;
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
         bp.include_descendants, bp.difficulty_band, bp.question_format, bp.has_image_only, bp.pick_count
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
 * Live "still seeing repeats" report, investigated rather than re-guessed:
 * checked real exposure data first (assess.user_question_seen) before
 * touching any code. Confirmed this policy is doing exactly what it was
 * designed to do — units are seeded with exactly 30 published questions
 * each (subjects have 330-365), so a handful of unit-scoped attempts
 * genuinely exhausts the unseen pool; recycling the least-recently-seen
 * ones at that point is the correct, intended fallback, not a defect, and
 * accounts with heavy repeated testing against small unit scopes showed
 * exactly this pattern (avg times-seen in the 8-12x range for some
 * accounts). That is a content-volume limit, not something a query change
 * can fix — more unique questions per unit is the only real remedy.
 *
 * One genuine latent risk was found and hardened regardless, even though a
 * live reproduction attempt (db/assess/test/generation/repeat-rotation.test.ts)
 * did not actually observe it misbehave on this Postgres build/plan:
 * `min(s.last_seen_at)` alone has no explicit tiebreaker, and startAttempt's
 * own serve-time exposure upsert (A6, attempt-flow.ts) stamps every
 * question served in one attempt with the *same* last_seen_at in one
 * batched query, so once a pool is exhausted, many candidates tie exactly
 * — leaving their relative order to Postgres's unspecified (not
 * contractually random) tie-breaking rather than this query's own seed.
 * Added the same seed-keyed md5 hash already used to randomize the unseen
 * bucket as an explicit final tiebreaker for the seen bucket too, so
 * rotation among tied candidates is deterministically seed-driven rather
 * than resting on incidental physical/plan ordering that could legally
 * change with a Postgres version, statistics, or plan shape.
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
// Test-layer hardening F1: both queries' descendant-scope match used to be
// `target.node_path || '%'` with no trailing path separator before the
// wildcard. node_path is generated as '/' || node_code per level with no
// delimiter of its own, so that pattern also matched a *sibling* node whose
// node_code happens to share target's as a prefix (e.g. target /PHY/U1 would
// wrongly also match sibling /PHY/U10) — a real SQL correctness defect that
// silently expands a line's scope the moment any two sibling node_codes
// share a prefix, not just a theoretical one. Appending '/%' instead requires
// an actual path separator right after target's own path, so only true
// descendants match. The target node itself is already covered separately
// by each query's own `qnm.node_id = $<n>::uuid` branch, so dropping the
// exact-match case from this LIKE clause loses nothing.
const LINE_CANDIDATE_SQL = `
  select q.question_id, q.content_fp, bool_or(s.question_id is not null) as was_seen
    from content.question q
    join content.question_node_map qnm on qnm.question_id = q.question_id
    join catalog.syllabus_node sn on sn.node_id = qnm.node_id
    left join assess.user_question_seen s on s.user_id = $2 and s.question_id = q.question_id
   where sn.subject_id = $1
     and q.lifecycle_status = 'published'
     and not (q.question_id = any ($4::uuid[]))
     and not (q.content_fp = any ($11::bytea[]))
     and (
           $5::uuid is null
           or qnm.node_id = $5::uuid
           or (
                $6::boolean
                and sn.node_path like (select target.node_path || '/%' from catalog.syllabus_node target where target.node_id = $5::uuid)
              )
         )
     and ($7::text is null or q.difficulty_band = $7::text)
     and ($8::text is null or q.question_type = $8::text)
     and ($10::boolean is not true or q.has_image = true)
   group by q.question_id
   order by
     bool_or(s.question_id is not null),
     case when bool_or(s.question_id is not null) = false then md5(q.question_id::text || $3::text) end,
     min(s.last_seen_at),
     md5(q.question_id::text || $3::text)
   limit $9
`;

/** Same filters as LINE_CANDIDATE_SQL (including F1's descendant-match fix above), minus the pick_count LIMIT — used only when a line comes back short, to report an honest "available" count. */
const LINE_AVAILABLE_SQL = `
  select count(distinct q.question_id) as available
    from content.question q
    join content.question_node_map qnm on qnm.question_id = q.question_id
    join catalog.syllabus_node sn on sn.node_id = qnm.node_id
   where sn.subject_id = $1
     and q.lifecycle_status = 'published'
     and not (q.question_id = any ($2::uuid[]))
     and not (q.content_fp = any ($8::bytea[]))
     and (
           $3::uuid is null
           or qnm.node_id = $3::uuid
           or (
                $4::boolean
                and sn.node_path like (select target.node_path || '/%' from catalog.syllabus_node target where target.node_id = $3::uuid)
              )
         )
     and ($5::text is null or q.difficulty_band = $5::text)
     and ($6::text is null or q.question_type = $6::text)
     and ($7::boolean is not true or q.has_image = true)
`;

/**
 * @throws {PoolInsufficientError} a blueprint line's candidate pool has
 *   fewer questions than its pick_count (after excluding this paper's own
 *   already-picked questions) — names the line and the counts
 *
 * Test-layer hardening A4: `client` defaults to the shared `pool` for
 * standalone callers, but `startAttempt` (attempt-flow.ts) already holds a
 * dedicated connection checked out via `pool.connect()` for its whole
 * transaction — the exact same shape of bug already found and fixed once in
 * this codebase for `loadSectionSchemes` (see that function's own comment).
 * `db/shared/pool.ts` caps the pool at 4 connections; calling `pool.query()`
 * from in here while `startAttempt`'s transaction client is still checked
 * out requests a 5th connection from an exhausted 4-connection pool under
 * concurrent load, deadlocking every in-flight `startAttempt` call forever.
 * Passing the transaction's own client through closes that hole the same
 * way `loadSectionSchemes` did.
 */
export async function assembleForAttempt(
  testId: string,
  userId: string,
  seed?: string,
  client: { query: typeof pool.query } = pool
): Promise<AssembleResult> {
  const generationSeed = seed ?? generateSeed();

  const linesRes = await client.query<BlueprintLine>(BLUEPRINT_LINES_SQL, [testId]);

  // docs/no-repeat-questions-fix.md Phase 3.1: question_id alone is no
  // longer the whole guard — docs/POOL_CENSUS.md found ~54% of the
  // published bank was byte-for-byte content clones under distinct
  // question_id before migration 031 collapsed them. pickedQuestionIds is
  // retained (cheap, keeps uq_test_question_test_id_question_id and the
  // attempt_question PK meaningful); pickedContentFps is the real guard —
  // excluded on every subsequent line so the same visible question can
  // never be drawn twice in one paper even via two different question_id
  // rows.
  const pickedQuestionIds: string[] = [];
  const pickedContentFps: Buffer[] = [];
  const pickedByFpHex = new Map<string, string>(); // content_fp hex -> question_id, for the Phase 3.2 assertion's error message
  const sections: AssembledSection[] = [];

  let totalRecycledCount = 0;

  for (const bp of linesRes.rows) {
    const res = await client.query<{ question_id: string; content_fp: Buffer | null; was_seen: boolean }>(LINE_CANDIDATE_SQL, [
      bp.subject_id,
      userId,
      generationSeed,
      pickedQuestionIds,
      bp.syllabus_node_id,
      bp.include_descendants,
      bp.difficulty_band,
      bp.question_format,
      bp.pick_count,
      bp.has_image_only,
      pickedContentFps,
    ]);
    const questionIds = res.rows.map((r) => r.question_id);

    if (questionIds.length < bp.pick_count) {
      const availableRes = await client.query<{ available: string }>(LINE_AVAILABLE_SQL, [
        bp.subject_id,
        pickedQuestionIds,
        bp.syllabus_node_id,
        bp.include_descendants,
        bp.difficulty_band,
        bp.question_format,
        bp.has_image_only,
        pickedContentFps,
      ]);
      throw new PoolInsufficientError(bp.blueprint_id, bp.test_section_id, bp.pick_count, Number(availableRes.rows[0].available));
    }

    // Phase 3.2 pre-persist assertion: content_fp should already be
    // impossible to repeat by construction (every prior pick is excluded
    // from every later line's candidate query above) — this is a fail-loud
    // backstop, not the primary guard. A row with a null content_fp (should
    // not exist post-migration-030 backfill, but not assumed here) can't be
    // checked for a content collision and is skipped rather than treated as
    // a false match.
    const duplicates: { questionIdA: string; questionIdB: string; contentFpHex: string }[] = [];
    for (const row of res.rows) {
      if (!row.content_fp) continue;
      const fpHex = row.content_fp.toString("hex");
      const existing = pickedByFpHex.get(fpHex);
      if (existing) {
        duplicates.push({ questionIdA: existing, questionIdB: row.question_id, contentFpHex: fpHex });
      } else {
        pickedByFpHex.set(fpHex, row.question_id);
      }
    }
    if (duplicates.length > 0) {
      throw new AssemblerDuplicateAssertionError(duplicates);
    }

    pickedQuestionIds.push(...questionIds);
    for (const row of res.rows) {
      if (row.content_fp) pickedContentFps.push(row.content_fp);
    }
    const contentFps = res.rows.map((r) => (r.content_fp ? r.content_fp.toString("hex") : ""));
    const recycledCount = res.rows.filter((r) => r.was_seen).length;
    totalRecycledCount += recycledCount;
    sections.push({
      blueprintId: bp.blueprint_id,
      testSectionId: bp.test_section_id,
      questionIds,
      contentFps,
      subjectId: bp.subject_id,
      syllabusNodeId: bp.syllabus_node_id,
      recycledCount,
    });
  }

  return { seed: generationSeed, sections, recycledCount: totalRecycledCount };
}
