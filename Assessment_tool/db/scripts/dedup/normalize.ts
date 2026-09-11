import crypto from "node:crypto";
import { normalizeStem } from "../../shared/normalizeStem.js";

/**
 * db/scripts/dedup/normalize.ts — the single normalisation + hashing module for
 * question-dedup-promptnew.md.
 *
 * WHY THIS DELEGATES INSTEAD OF REIMPLEMENTING
 * --------------------------------------------
 * This repo already has two normalisers that must not drift:
 *
 *   db/shared/normalizeStem.ts  == content.fn_normalize_stem   (migration 030)
 *   content.fn_question_stem_norm                              (migrations 037/039)
 *
 * The second is the aggressive one: it strips the generator's decorative
 * "In <Chapter Name>, " lead-in and semantically null interrogative frames
 * BEFORE handing off to the first. content.question.stem_norm is a
 * trigger-maintained column holding exactly that value for all 1400 live
 * rows, and migration 041's UNIQUE index is built on a key derived from it.
 *
 * The prompt's Section 2 normalisation list (lowercase, strip HTML/markdown,
 * collapse whitespace, strip punctuation + LaTeX artefacts + leading
 * numbering, NFKC, smart quotes, dashes, trailing boilerplate) is a SUBSET of
 * what those two already do together. Writing a third implementation would
 * create a third source of truth that silently disagrees with the live
 * `stem_norm` column — and the moment file-side normalisation disagrees with
 * DB-side normalisation, Phase 3's "is this batch question already live?"
 * check starts returning false negatives with no error.
 *
 * So `normalizeForMatch` is a faithful TypeScript mirror of
 * content.fn_question_stem_norm, and db/scripts/dedup/integration.test.ts asserts it agrees
 * with the live database on every published stem in the bank. If you change a
 * rule here, change it in SQL too, in the same order, and the parity test
 * will tell you if you did not.
 */

/**
 * Decorative chapter/topic lead-in, comma-tolerant — mirrors migration 039's
 * pattern character for character.
 *
 * Postgres `regexp_replace` without the 'g' flag replaces the FIRST match
 * only; the pattern is anchored at the start so a non-global JS replace is
 * identical. The pattern is case-sensitive in SQL (no 'i' flag), so no 'i'
 * here either — the title-casing is the signal that this is an interpolated
 * chapter name and not ordinary prose ("In the reaction below, ..." must not
 * match).
 */
const CHAPTER_LEAD_IN =
  /^\s*In\s+[A-Z][A-Za-z]*(\s+[A-Za-z]+)*(,\s*[A-Z][A-Za-z]*(\s+[A-Za-z]+)*)*,\s*(?=[a-z])/;

/**
 * Semantically null leading interrogative frames. Case-insensitive in SQL
 * ('i' flag), so case-insensitive here.
 *
 * This is the prompt's "strip trailing boilerplate such as 'Which of the
 * following is correct?' only when it appears in >X% of rows" rule, in its
 * leading form. It was frequency-derived against this corpus in migration
 * 037 rather than guessed — see that file's measured marginal-contribution
 * table. Deliberately narrow: leading frames only, never mid-stem text,
 * because mid-stem topic references are load-bearing (migration 039's scope
 * note gives the two live counterexamples).
 */
const NULL_INTERROGATIVE_FRAME =
  /^\s*(which\s+one\s+of\s+the\s+following|which\s+of\s+the\s+following|which\s+of\s+these|what\s+is\s+the\s+specific|what\s+is\s+the)\s+/i;

/**
 * Dash folding — the prompt's "normalise ... en/em dashes" rule, which the
 * frozen normaliser does NOT do, and the omission is a real asymmetry rather
 * than a cosmetic one:
 *
 *   normalizeStem keeps ASCII "-" (it is in the allowed math-operator set)
 *   and strips U+2013 / U+2014 (they are not). So "well-known" and
 *   "well—known" produce different keys and hash differently.
 *
 * Folding every dash variant onto ASCII "-" before the punctuation strip
 * makes them agree. Measured blast radius on the live bank at the time of
 * writing: 1 published stem of 533 contains an en/em dash and 0 contain smart
 * quotes (smart quotes already normalise identically, because BOTH the curly
 * and the straight forms are stripped as punctuation).
 *
 * Mirrored in SQL by migration 043. Until that migration is applied the
 * database's fn_question_stem_norm and this function disagree on exactly
 * those dash-bearing stems, and db/scripts/dedup/integration.test.ts detects whether 043 is
 * live and says so rather than passing quietly.
 */
const DASH_VARIANTS = /[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g;

/**
 * The Tier-1 match key. Mirrors content.fn_question_stem_norm(stem_text).
 *
 * THE STEM IS THE ONLY INPUT. Options, correct answer, difficulty, topic and
 * explanation are deliberately absent — Section 2 of the prompt: "one stem =
 * one question. Nothing else is considered."
 */
export function normalizeForMatch(input: string | null | undefined): string {
  const folded = (input ?? "").replace(DASH_VARIANTS, "-");
  const withoutLeadIn = folded.replace(CHAPTER_LEAD_IN, "");
  const withoutFrame = withoutLeadIn.replace(NULL_INTERROGATIVE_FRAME, "");
  return normalizeStem(withoutFrame);
}

/** Tier 1 identity: sha256(normalised_stem), hex. Options/answers are NOT in it. */
export function matchHash(stemText: string | null | undefined): string {
  return crypto.createHash("sha256").update(normalizeForMatch(stemText), "utf8").digest("hex");
}

/**
 * Ordered sequence of every numeric literal in the normalised stem.
 *
 * This is the prompt's one guard against the stem-only rule: "if the digit
 * sequences inside the two stems differ ... they're numeric variants" — route
 * to Tier 3, never auto-delete. It is measured, not theoretical: on this
 * bank, ALL 1451 published pairs at trigram similarity >= 0.92 have differing
 * digit signatures. Every single Tier-2 candidate in the live database is a
 * numeric variant. Without this guard, Tier 2 would auto-delete a large set
 * of questions that are all genuinely different.
 *
 * Computed on the NORMALISED stem so that "5kg" / "5 kg" and "2.50" / "2.5"
 * do not read as different signatures for typographic reasons alone.
 */
export function digitSignature(stemText: string | null | undefined): string {
  const normalised = normalizeForMatch(stemText);
  const literals = normalised.match(/\d+(?:\.\d+)?/g) ?? [];
  // Trailing zeros in a decimal are typography, not quantity: 2.50 === 2.5.
  return literals.map((n) => String(Number(n))).join("|");
}

// ---------------------------------------------------------------------------
// Similarity
// ---------------------------------------------------------------------------

/**
 * pg_trgm-compatible trigram set for a string.
 *
 * Deliberately reproduces PostgreSQL's algorithm rather than inventing one,
 * because Tier 2 has to give the same answer whether it is computed in SQL
 * (against the live bank, using the GIN index) or in TypeScript (against
 * batch files, which are not in the database). pg_trgm:
 *
 *   1. lower-cases the input;
 *   2. splits on non-alphanumeric characters into words;
 *   3. pads each word as "  word " (two leading spaces, one trailing);
 *   4. takes every 3-character window; the result is a SET (distinct).
 *
 * similarity(a, b) = |A n B| / |A u B|.
 */
export function trigramSet(input: string): Set<string> {
  const words = input.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 0);
  const out = new Set<string>();
  for (const word of words) {
    const padded = "  " + word + " ";
    for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  }
  return out;
}

/**
 * Trigram sets for one string, memoised.
 *
 * The ingestion gate compares each incoming question against the whole
 * published bank, so the same 533 corpus strings are re-tokenised once per
 * incoming record. Building the set is the entire cost of a comparison;
 * caching it turns an O(incoming x corpus x length) pass into one corpus
 * tokenisation plus set intersections. The cache is keyed by the normalised
 * string, which is already deduplicated by construction.
 */
const trigramCache = new Map<string, Set<string>>();

export function cachedTrigramSet(input: string): Set<string> {
  let set = trigramCache.get(input);
  if (!set) {
    set = trigramSet(input);
    // A drop far larger than this bank should not grow the cache without
    // bound; at that point the corpus, not the cache, is the thing to index.
    if (trigramCache.size > 50_000) trigramCache.clear();
    trigramCache.set(input, set);
  }
  return set;
}

/** pg_trgm `similarity()`: Jaccard over trigram sets. */
export function trigramSimilarity(a: string, b: string): number {
  const setA = cachedTrigramSet(a);
  const setB = cachedTrigramSet(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const t of small) if (large.has(t)) intersection++;
  return intersection / (setA.size + setB.size - intersection);
}

/**
 * RapidFuzz-style token_set_ratio, offered alongside trigram similarity
 * because the prompt names it as an alternative and because the two disagree
 * in a useful way: token_set_ratio is insensitive to word ORDER and to
 * repeated words, so it catches a re-ordered clause that trigram similarity
 * scores lower. Reported in the audit; NOT used as the auto-delete gate
 * (trigram is, so that DB-side and file-side agree exactly).
 */
export function tokenSetRatio(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  const shared = [...tokensA].filter((t) => tokensB.has(t)).sort();
  const onlyA = [...tokensA].filter((t) => !tokensB.has(t)).sort();
  const onlyB = [...tokensB].filter((t) => !tokensA.has(t)).sort();
  const base = shared.join(" ");
  const left = [base, ...onlyA].join(" ").trim();
  const right = [base, ...onlyB].join(" ").trim();
  return Math.max(ratio(base, left), ratio(base, right), ratio(left, right));
}

/** Indel-similarity ratio (RapidFuzz's `ratio`): 2*LCS / (len(a)+len(b)). */
function ratio(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  return (2 * lcsLength(a, b)) / (a.length + b.length);
}

function lcsLength(a: string, b: string): number {
  // Rolling single-row LCS — O(len(a) * len(b)) time, O(len(b)) space.
  let previous = new Uint32Array(b.length + 1);
  let current = new Uint32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      current[j] =
        a[i - 1] === b[j - 1] ? previous[j - 1] + 1 : Math.max(previous[j], current[j - 1]);
    }
    const swap = previous;
    previous = current;
    current = swap;
    current.fill(0);
  }
  return previous[b.length];
}

// ---------------------------------------------------------------------------
// Blocking
// ---------------------------------------------------------------------------

/**
 * Blocking keys for Tier 2 candidate generation.
 *
 * DELIBERATE DEVIATION FROM THE PROMPT, WITH THE MEASUREMENT THAT FORCED IT.
 * The prompt specifies "blocking key = first 40 characters of the normalised
 * stem". Measured against the live bank (533 published rows):
 *
 *   pairs at trigram similarity >= 0.92, no blocking          1451
 *   pairs at trigram similarity >= 0.92, left(stem_norm,40)     179
 *
 * The prefix key finds 12% of the real candidate pairs and silently drops the
 * other 88%. It fails on exactly the population this pass exists to catch:
 * template-family questions whose difference is an early numeric literal, so
 * they diverge inside the first 40 characters while being near-identical
 * overall.
 *
 * Replaced with a union of three keys — two records are compared if they
 * share ANY of them:
 *
 *   1. digit-collapsed skeleton  — the template-family key. Two numeric
 *      variants of one template share it exactly. This is the one the prefix
 *      key was missing.
 *   2. sorted rare-token pairs   — order-insensitive, survives a re-ordered
 *      or re-worded opening clause.
 *   3. first 40 chars            — the prompt's key, kept because it costs
 *      nothing and catches long stems whose tokens are all common.
 *
 * Recall of the union is verified in dedup/cluster.test.ts against exhaustive
 * all-pairs: it must find every pair all-pairs finds.
 *
 * At or under EXHAUSTIVE_MAX records the toolkit skips blocking entirely and
 * does exhaustive all-pairs — at this corpus size (~1900 records) that is
 * under two million comparisons and runs in seconds, and an exact answer
 * beats a fast approximate one when the output is a deletion plan.
 */
export const EXHAUSTIVE_MAX = 5000;

/** Digit-collapsed skeleton of the normalised stem — the template-family key. */
export function skeletonKey(normalised: string): string {
  return normalised.replace(/\d+(?:\.\d+)?/g, "#");
}

const STOPWORDS = new Set([
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "is", "are",
  "was", "were", "be", "been", "by", "with", "from", "as", "that", "this", "it",
  "its", "if", "then", "than", "which", "what", "when", "where", "how", "why",
  "will", "would", "can", "could", "has", "have", "had", "do", "does", "not",
]);

export function blockingKeys(normalised: string): string[] {
  const keys = new Set<string>();

  keys.add("skel:" + skeletonKey(normalised));
  keys.add("pfx:" + normalised.slice(0, 40));

  // Rare-token pairs: the four longest non-stopword tokens, taken pairwise and
  // sorted, so word order cannot change the key.
  const tokens = [...new Set(normalised.split(" ").filter((t) => t.length > 3 && !STOPWORDS.has(t)))]
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .slice(0, 4);
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      keys.add("tok:" + [tokens[i], tokens[j]].sort().join("~"));
    }
  }

  return [...keys];
}

// ---------------------------------------------------------------------------
// Stable identity
// ---------------------------------------------------------------------------

/**
 * Phase 4: "stable question_id (uuid v5 over the normalised match key so the
 * same question always gets the same id)".
 *
 * RFC 4122 v5 (SHA-1, name-based). Implemented here rather than pulled from a
 * dependency because `uuid` is not in this project's dependency tree and the
 * algorithm is twenty lines.
 *
 * SCOPE NOTE: this id is the identity of a question in the CONTENT FILES. It
 * is NOT written to content.question.question_id — those are live primary
 * keys with foreign keys pointing at them from attempt history, and re-keying
 * them would orphan every attempt in the bank. The file-side id is carried
 * into the database as `external_ref` at push time so the two stay linked.
 */
const DEDUP_NAMESPACE = "6f2b1c84-2a1e-5f7d-9c3a-8b5e4d1f0a76";

export function stableQuestionId(stemText: string | null | undefined): string {
  const namespaceBytes = Buffer.from(DEDUP_NAMESPACE.replace(/-/g, ""), "hex");
  const nameBytes = Buffer.from(normalizeForMatch(stemText), "utf8");
  const hash = crypto.createHash("sha1").update(Buffer.concat([namespaceBytes, nameBytes])).digest();

  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = hash.subarray(0, 16).toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Lowercase, no spaces, filesystem-safe — Phase 4's file-naming rule. */
export function slugify(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "untitled";
}

export function sha256Hex(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
