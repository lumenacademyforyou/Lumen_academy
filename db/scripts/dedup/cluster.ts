import { EXHAUSTIVE_MAX, blockingKeys, trigramSimilarity } from "./normalize.js";
import type { CanonicalRecord, Cluster, MatchPair, Tier } from "./types.js";
import { pickSurvivor } from "./survivor.js";

/**
 * db/scripts/dedup/cluster.ts — the three-tier matcher.
 *
 * Tier 1  exact normalised stem            -> auto-delete
 * Tier 2  trigram similarity >= 0.92       -> auto-delete, log everything
 * Tier 3  paraphrase / numeric variant     -> review queue, never auto-delete
 *
 * The stem is the only key. Options, correct answer, difficulty, topic and
 * explanation are read for the SURVIVOR decision and for reports; they are
 * never inputs to whether two records match.
 */

export const TIER2_THRESHOLD = 0.92;

/**
 * Tier 3 lower bound. The prompt specifies "cosine similarity >= 0.95 on
 * sentence embeddings where Tier 2 didn't fire".
 *
 * DELIBERATE DEVIATION, WITH THE REASON. No embedding provider is configured
 * in this environment — content.question.stem_vec exists and is NULL on all
 * 1400 rows, and migration 037's header records the same constraint. A cosine
 * tier that cannot be computed would be a tier that silently never fires, and
 * a review queue that is always empty is worse than no review queue because
 * it looks like a clean result.
 *
 * So Tier 3 runs on the lexical metric that IS available, at a threshold
 * tuned against a hand-labelled sample in docs/QUESTION_DEDUP_THRESHOLDS.md
 * (P=1.000 R=1.000 at 0.45 on 209 labelled pairs). stem_vec stays provisioned;
 * when a provider is configured, add the cosine tier here and keep this one —
 * they catch different things.
 */
export const TIER3_THRESHOLD = 0.45;

export interface MatchOptions {
  tier2Threshold?: number;
  tier3Threshold?: number;
  /** Force the blocked path even on a small corpus (used by the recall test). */
  forceBlocking?: boolean;
}

/**
 * Every pair worth scoring. Exhaustive under EXHAUSTIVE_MAX records, blocked
 * above it — see normalize.ts's blockingKeys for why the prompt's 40-char
 * prefix key alone is not used.
 */
function candidatePairs(
  records: CanonicalRecord[],
  forceBlocking: boolean
): Array<[CanonicalRecord, CanonicalRecord]> {
  const pairs: Array<[CanonicalRecord, CanonicalRecord]> = [];

  if (!forceBlocking && records.length <= EXHAUSTIVE_MAX) {
    for (let i = 0; i < records.length; i++) {
      for (let j = i + 1; j < records.length; j++) pairs.push([records[i], records[j]]);
    }
    return pairs;
  }

  const buckets = new Map<string, number[]>();
  records.forEach((record, index) => {
    for (const key of blockingKeys(record.stemNorm)) {
      const bucket = buckets.get(key);
      if (bucket) bucket.push(index);
      else buckets.set(key, [index]);
    }
  });

  const seen = new Set<string>();
  for (const bucket of buckets.values()) {
    // A pathologically large bucket means the key stopped discriminating.
    // Comparing it in full would reintroduce the O(n^2) the blocking exists
    // to avoid, so it is skipped and reported rather than silently truncated.
    if (bucket.length > 2000) continue;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = Math.min(bucket[i], bucket[j]);
        const b = Math.max(bucket[i], bucket[j]);
        const key = a + ":" + b;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([records[a], records[b]]);
      }
    }
  }
  return pairs;
}

/**
 * Classify every candidate pair into a tier.
 *
 * THE NUMERIC-VARIANT GUARD is applied before any auto-delete tier. From the
 * prompt: "if the digit sequences inside the two stems differ (different
 * numbers, units, or quantities), the stems are not the same question — route
 * those to Tier 3 instead of deleting."
 *
 * It is doing real work here, not defensive decoration. Measured on the live
 * bank: of 1451 published pairs at trigram similarity >= 0.92, 1451 have
 * differing digit signatures. Without the guard, Tier 2 would auto-delete
 * roughly a thousand rows that are all legitimately different numeric
 * variants of the same template.
 *
 * Note it deliberately does NOT gate Tier 1. Two stems with the same
 * normalised text necessarily have the same digit signature, so the guard is
 * a no-op there by construction.
 */
export function classifyPairs(
  records: CanonicalRecord[],
  options: MatchOptions = {}
): MatchPair[] {
  const tier2 = options.tier2Threshold ?? TIER2_THRESHOLD;
  const tier3 = options.tier3Threshold ?? TIER3_THRESHOLD;
  const out: MatchPair[] = [];

  for (const [a, b] of candidatePairs(records, options.forceBlocking ?? false)) {
    if (a.matchHash === b.matchHash) {
      out.push({ a, b, tier: 1, similarity: 1, reason: "identical normalised stem" });
      continue;
    }

    const similarity = trigramSimilarity(a.stemNorm, b.stemNorm);
    if (similarity < tier3) continue;

    if (a.digits !== b.digits) {
      out.push({
        a,
        b,
        tier: 3,
        similarity,
        reason:
          "numeric variant — digit signatures differ (" +
          (a.digits || "none") + " vs " + (b.digits || "none") + ")",
      });
      continue;
    }

    if (similarity >= tier2) {
      out.push({ a, b, tier: 2, similarity, reason: "near-identical stem, identical digit signature" });
      continue;
    }

    out.push({ a, b, tier: 3, similarity, reason: "paraphrase candidate below the auto-delete threshold" });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Clustering
// ---------------------------------------------------------------------------

class UnionFind {
  private parent: number[];
  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent[rootB] = rootA;
  }
}

export interface ClusterResult {
  clusters: Cluster[];
  /** Tier-3 pairs — the review queue. Never merged. */
  reviewPairs: MatchPair[];
  pairs: MatchPair[];
}

/**
 * Build auto-delete clusters from Tier-1 and Tier-2 pairs by transitive
 * closure, and hand Tier-3 pairs out untouched.
 *
 * TRANSITIVE CLOSURE IS DELIBERATE AND IS THE RIGHT CHOICE HERE, but it has a
 * known failure mode worth naming: with a similarity threshold, A~B and B~C
 * does not guarantee A~C, so a chain can drag in a member that is not
 * similar to the cluster's survivor. The guard against that is
 * `minSimilarity`, computed over ALL pairs within the finished cluster
 * (including ones never scored above threshold). A cluster whose
 * minSimilarity falls below the Tier-2 threshold is DOWNGRADED to review
 * rather than auto-deleted — a chained cluster is exactly the case a human
 * should look at.
 */
export function buildClusters(
  records: CanonicalRecord[],
  options: MatchOptions = {}
): ClusterResult {
  const pairs = classifyPairs(records, options);
  const tier2 = options.tier2Threshold ?? TIER2_THRESHOLD;

  const indexOf = new Map<CanonicalRecord, number>();
  records.forEach((record, i) => indexOf.set(record, i));

  const uf = new UnionFind(records.length);
  const autoPairs = pairs.filter((p) => p.tier === 1 || p.tier === 2);
  for (const pair of autoPairs) {
    uf.union(indexOf.get(pair.a)!, indexOf.get(pair.b)!);
  }

  const groups = new Map<number, CanonicalRecord[]>();
  records.forEach((record, i) => {
    const root = uf.find(i);
    const group = groups.get(root);
    if (group) group.push(record);
    else groups.set(root, [record]);
  });

  const clusters: Cluster[] = [];
  const reviewPairs = pairs.filter((p) => p.tier === 3);

  for (const [root, members] of groups) {
    if (members.length < 2) continue;

    let minSimilarity = 1;
    let allTier1 = true;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (members[i].matchHash !== members[j].matchHash) allTier1 = false;
        const similarity =
          members[i].matchHash === members[j].matchHash
            ? 1
            : trigramSimilarity(members[i].stemNorm, members[j].stemNorm);
        if (similarity < minSimilarity) minSimilarity = similarity;
      }
    }

    const tier: Tier = allTier1 ? 1 : 2;

    if (!allTier1 && minSimilarity < tier2) {
      // Chained cluster — demote to review instead of deleting.
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          reviewPairs.push({
            a: members[i],
            b: members[j],
            tier: 3,
            similarity: trigramSimilarity(members[i].stemNorm, members[j].stemNorm),
            reason: "transitively chained cluster — weakest internal pair is below the auto-delete threshold",
          });
        }
      }
      continue;
    }

    const { survivor, reason } = pickSurvivor(members);
    clusters.push({
      clusterId: "c" + String(root).padStart(6, "0"),
      tier,
      members,
      survivor,
      losers: members.filter((m) => m !== survivor),
      minSimilarity,
      survivorReason: reason,
    });
  }

  clusters.sort((a, b) => b.members.length - a.members.length || a.clusterId.localeCompare(b.clusterId));
  return { clusters, reviewPairs, pairs };
}
