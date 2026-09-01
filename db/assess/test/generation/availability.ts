/**
 * checkAvailability — docs/test-engine-fix-prompt.md Defect 6.
 *
 * Answers "how many questions can this configuration actually produce?"
 * *before* any assess.test row exists, so the config screen can warn the
 * student instead of letting them press Start into a PoolInsufficientError.
 *
 * The one rule that makes this worth building: **the number must be produced
 * by the same predicate the assembler will actually run.** A separate
 * "count the rows in this unit" query is the thing the spec calls out as
 * making the notification lie — raw rows include content clones and template
 * variants that the assembler will collapse, so the student is promised a
 * pool that cannot be delivered. This module therefore imports
 * LINE_CANDIDATE_SQL and LINE_AVAILABLE_SQL from assemble.ts rather than
 * writing its own SQL: same joins, same lifecycle filter, same content_fp
 * exclusion, same skeleton_fp template-family guard, same sequential
 * cross-line exclusion. If the assembler's predicate changes, this changes
 * with it, because it is literally the same string.
 *
 * The only difference from a real assembly is that this never persists
 * anything and never throws on a shortfall — it reports one.
 */
import { pool } from "../../../shared/pool.js";
import { LINE_CANDIDATE_SQL, LINE_AVAILABLE_SQL } from "./assemble.js";

/**
 * Reason codes, exactly the set the spec names.
 *
 * EXCLUDED_RECENTLY_ATTEMPTED is defined but never emitted, and that is a
 * deliberate, documented choice rather than an oversight: this app's
 * anti-repeat policy (D-2, see LINE_CANDIDATE_SQL's own header) is a *soft
 * sort*, never a hard exclusion — a previously-seen question is deprioritised
 * but always still eligible. Nothing is ever excluded for having been
 * attempted recently, so a truthful availability check can never attribute a
 * shortfall to it. The code stays in the union so the contract matches the
 * spec and so the day someone introduces a hard anti-repeat window, the
 * reason is already wired end to end.
 */
export type ShortfallReason =
  | "POOL_TOO_SMALL"
  | "FILTERED_OUT_BY_DIFFICULTY"
  | "EXCLUDED_RECENTLY_ATTEMPTED"
  | "NO_VALID_IMAGE"
  | "UNIT_NOT_PUBLISHED";

/** One blueprint line, as the config screen describes it — before any test row exists. */
export interface AvailabilityLine {
  subjectId: string;
  syllabusNodeId?: string | null;
  includeDescendants?: boolean;
  difficultyBand?: string | null;
  questionFormat?: string | null;
  hasImageOnly?: boolean;
  pickCount: number;
  /** For the per-unit breakdown row's label. Falls back to a DB lookup when absent. */
  sectionName?: string;
}

export interface AvailabilityUnitRow {
  unitId: string | null;
  unitName: string;
  requested: number;
  available: number;
  reason: ShortfallReason;
}

export interface AvailabilityResult {
  configHash: string;
  requested: number;
  available: number;
  shortfall: number;
  byUnit: AvailabilityUnitRow[];
}

/**
 * Stable hash of everything that can change the answer. The client sends its
 * config and gets this back; the banner then renders only while the hash it
 * holds still matches the hash of the config currently on screen (Defect 4's
 * scoping rule). Sorted keys and sorted lines so two configs that differ only
 * in property or line order hash the same.
 */
export async function computeConfigHash(mode: string, lines: AvailabilityLine[], totalCount: number): Promise<string> {
  const crypto = await import("node:crypto");
  const canonical = JSON.stringify({
    mode,
    totalCount,
    lines: lines
      .map((l) => ({
        subjectId: l.subjectId,
        syllabusNodeId: l.syllabusNodeId ?? null,
        includeDescendants: l.includeDescendants ?? true,
        difficultyBand: l.difficultyBand ?? null,
        questionFormat: l.questionFormat ?? null,
        hasImageOnly: l.hasImageOnly ?? false,
        pickCount: l.pickCount,
      }))
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
  });
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 32);
}

/** Published, family-deduped count for one line, with an optional filter dropped. */
async function availableFor(
  line: AvailabilityLine,
  userId: string,
  excludedIds: string[],
  excludedContentFps: Buffer[],
  excludedSkeletonFps: Buffer[],
  excludedAnswerKeys: string[],
  excludedCanonicalIds: string[],
  overrides: { ignoreDifficulty?: boolean; ignoreImage?: boolean; ignoreScope?: boolean },
  client: { query: typeof pool.query }
): Promise<number> {
  // LINE_AVAILABLE_SQL now shares CANDIDATE_BODY with LINE_CANDIDATE_SQL, so
  // it takes the identical 15 parameters. The seed is fixed ("availability")
  // for the same reason the draw below fixes it: which questions come back
  // does not matter to a count, only how many.
  const res = await client.query<{ available: string }>(LINE_AVAILABLE_SQL, [
    line.subjectId,
    userId,
    "availability",
    excludedIds,
    overrides.ignoreScope ? null : (line.syllabusNodeId ?? null),
    line.includeDescendants ?? true,
    overrides.ignoreDifficulty ? null : (line.difficultyBand ?? null),
    line.questionFormat ?? null,
    line.pickCount,
    overrides.ignoreImage ? false : (line.hasImageOnly ?? false),
    excludedContentFps,
    excludedSkeletonFps,
    excludedAnswerKeys,
    excludedCanonicalIds,
    null,
  ]);
  return Number(res.rows[0].available);
}

/**
 * Why this line came up short. Determined by re-asking the same query with
 * one filter relaxed at a time — an actual measurement of which filter is
 * responsible, not a guess from which fields happen to be set.
 */
async function diagnoseShortfall(
  line: AvailabilityLine,
  userId: string,
  available: number,
  excludedIds: string[],
  excludedContentFps: Buffer[],
  excludedSkeletonFps: Buffer[],
  excludedAnswerKeys: string[],
  excludedCanonicalIds: string[],
  client: { query: typeof pool.query }
): Promise<ShortfallReason> {
  // Nothing published in this scope at all, with every optional filter off?
  // Then the unit itself is the problem, not the filters.
  const bare = await availableFor(line, userId, [], [], [], [], [], { ignoreDifficulty: true, ignoreImage: true }, client);
  if (bare === 0) return "UNIT_NOT_PUBLISHED";

  if (line.hasImageOnly) {
    const withoutImage = await availableFor(line, userId, excludedIds, excludedContentFps, excludedSkeletonFps, excludedAnswerKeys, excludedCanonicalIds, { ignoreImage: true }, client);
    if (withoutImage >= line.pickCount && withoutImage > available) return "NO_VALID_IMAGE";
  }

  if (line.difficultyBand) {
    const withoutDifficulty = await availableFor(line, userId, excludedIds, excludedContentFps, excludedSkeletonFps, excludedAnswerKeys, excludedCanonicalIds, { ignoreDifficulty: true }, client);
    if (withoutDifficulty >= line.pickCount && withoutDifficulty > available) return "FILTERED_OUT_BY_DIFFICULTY";
  }

  return "POOL_TOO_SMALL";
}

/**
 * Walks the lines in the same order and with the same running exclusions the
 * assembler will, so the reported per-line availability is what that line
 * would really get — not what it would get in isolation. Two lines over the
 * same unit cannot both be told "30 available" when the unit holds 30 in
 * total; the second sees 30 minus whatever the first took.
 */
export async function checkAvailability(
  mode: string,
  lines: AvailabilityLine[],
  userId: string,
  client: { query: typeof pool.query } = pool
): Promise<AvailabilityResult> {
  const requested = lines.reduce((n, l) => n + l.pickCount, 0);
  const configHash = await computeConfigHash(mode, lines, requested);

  const excludedIds: string[] = [];
  const excludedContentFps: Buffer[] = [];
  const excludedSkeletonFps: Buffer[] = [];
  // Layer 4: mirrors assembleForAttempt's own running exclusions. Without
  // these two the count reported to the student would exceed what the
  // assembler can actually deliver, which is the exact "the notification
  // lies" failure this module exists to prevent.
  const excludedAnswerKeys: string[] = [];
  const excludedCanonicalIds: string[] = [];
  const byUnit: AvailabilityUnitRow[] = [];
  let totalAvailable = 0;

  // Unit labels, resolved once for every scoped line rather than per line.
  const nodeIds = lines.map((l) => l.syllabusNodeId).filter((id): id is string => Boolean(id));
  const nodeNames = new Map<string, string>();
  if (nodeIds.length > 0) {
    const res = await client.query<{ node_id: string; title: string }>(
      `select node_id, title from catalog.syllabus_node where node_id = any ($1::uuid[])`,
      [nodeIds]
    );
    for (const row of res.rows) nodeNames.set(row.node_id, row.title);
  }
  const subjectNames = new Map<string, string>();
  {
    const res = await client.query<{ subject_id: string; subject_name: string }>(
      `select subject_id, subject_name from catalog.subject where subject_id = any ($1::uuid[])`,
      [[...new Set(lines.map((l) => l.subjectId))]]
    );
    for (const row of res.rows) subjectNames.set(row.subject_id, row.subject_name);
  }

  for (const line of lines) {
    // Draw exactly as the assembler would — same query, same seed-free
    // ordering — so the exclusions carried into the next line are the real
    // ones. The seed is fixed here ("availability") because *which* questions
    // come back does not matter to a count; only how many, and that the same
    // ones are removed from later lines' pools.
    const drawn = await client.query<{
      question_id: string;
      content_fp: Buffer | null;
      skeleton_fp: Buffer | null;
      canonical_id: string;
      answer_key: string | null;
    }>(LINE_CANDIDATE_SQL, [
      line.subjectId,
      userId,
      "availability",
      excludedIds,
      line.syllabusNodeId ?? null,
      line.includeDescendants ?? true,
      line.difficultyBand ?? null,
      line.questionFormat ?? null,
      line.pickCount,
      line.hasImageOnly ?? false,
      excludedContentFps,
      excludedSkeletonFps,
      excludedAnswerKeys,
      excludedCanonicalIds,
      // Uncapped, matching assembleForAttempt's own default. If a caller ever
      // passes a per-node cap to the assembler, it has to be passed here too
      // or this count goes back to over-reporting.
      null,
    ]);

    const got = drawn.rowCount ?? 0;
    totalAvailable += got;

    if (got < line.pickCount) {
      const reason = await diagnoseShortfall(line, userId, got, excludedIds, excludedContentFps, excludedSkeletonFps, excludedAnswerKeys, excludedCanonicalIds, client);
      byUnit.push({
        unitId: line.syllabusNodeId ?? null,
        unitName:
          line.sectionName ??
          (line.syllabusNodeId ? (nodeNames.get(line.syllabusNodeId) ?? "This unit") : (subjectNames.get(line.subjectId) ?? "This subject")),
        requested: line.pickCount,
        available: got,
        reason,
      });
    }

    for (const row of drawn.rows) {
      excludedIds.push(row.question_id);
      if (row.content_fp) excludedContentFps.push(row.content_fp);
      if (row.skeleton_fp) excludedSkeletonFps.push(row.skeleton_fp);
      if (row.answer_key) excludedAnswerKeys.push(row.answer_key);
      excludedCanonicalIds.push(row.canonical_id);
    }
  }

  return {
    configHash,
    requested,
    available: totalAvailable,
    shortfall: Math.max(0, requested - totalAvailable),
    byUnit,
  };
}
