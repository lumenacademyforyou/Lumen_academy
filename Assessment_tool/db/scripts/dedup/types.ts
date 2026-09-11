/**
 * db/scripts/dedup/types.ts — the one record shape every phase works on.
 *
 * Live database rows and on-disk batch questions are loaded into the SAME
 * `CanonicalRecord`, because Phase 3 has to compare a batch question against
 * a live row and Phase 5 has to compare an incoming question against both.
 * If the two sources had separate shapes, the cross-source comparison would
 * be the place where fields quietly stopped lining up.
 */

export type RecordOrigin = "db" | "file";

export interface DedupOption {
  label: string | null;
  text: string;
  isCorrect: boolean;
  /** Live option_id where the record came from the database; null for files. */
  optionId?: string | null;
}

export interface CanonicalRecord {
  origin: RecordOrigin;

  /** Live primary key (origin === "db"), else null. */
  questionId: string | null;
  /** LMN-... authoring id. Present on both sources. */
  questionUid: string | null;
  /** uuid v5 over the normalised match key — stable across sources and runs. */
  stableId: string;

  stemText: string;
  /** normalizeForMatch(stemText) — cached because every tier reads it. */
  stemNorm: string;
  /** sha256(stemNorm) — the Tier-1 identity. */
  matchHash: string;
  /** Ordered numeric literals; the numeric-variant guard. */
  digits: string;

  options: DedupOption[];
  questionType: string | null;
  difficultyBand: string | null;
  subjectCode: string | null;
  nodeTagCode: string | null;
  explanation: string | null;
  numericAnswer: string | null;
  lifecycleStatus: string | null;
  sourceBatch: string | null;
  /** Live rows have no created_at column — see survivor.ts for what stands in. */
  createdAt: string | null;

  /** File provenance: where this record physically lives. */
  filePath?: string;
  fileIndex?: number;

  /**
   * How many rows in other tables point at this question. Populated for
   * origin === "db" only; drives canonical survivor rule 1.
   */
  referenceCount?: number;

  /** The untouched source object, for quarantine payloads and audit snapshots. */
  raw: unknown;
}

export type Tier = 1 | 2 | 3;

export interface MatchPair {
  a: CanonicalRecord;
  b: CanonicalRecord;
  tier: Tier;
  similarity: number;
  /** Why this pair landed in the tier it did — printed in every report. */
  reason: string;
}

export interface Cluster {
  clusterId: string;
  tier: Tier;
  members: CanonicalRecord[];
  survivor: CanonicalRecord;
  losers: CanonicalRecord[];
  /** Lowest pairwise similarity inside the cluster. 1 for Tier-1 clusters. */
  minSimilarity: number;
  survivorReason: string;
}
