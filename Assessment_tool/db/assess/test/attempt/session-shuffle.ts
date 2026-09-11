/**
 * db/assess/test/attempt/session-shuffle.ts — per-session display shuffling.
 *
 * Companion to the dedup toolkit, implementing `session-shuffle-prompt.md`.
 * The dedup pass removes duplicate questions; this module is why they never
 * need to come back: variety between sessions is produced at print time and
 * thrown away, not stored as extra copies of a question.
 *
 * THE RULE
 * --------
 * One question exists once in the database, forever. Two things shuffle per
 * session — option order inside a question, and question order within a set.
 * Nothing else changes: stem, option texts, correct answer, difficulty,
 * metadata and every id are exactly what is in the bank.
 *
 * WHERE THIS MAY AND MAY NOT BE CALLED
 * ------------------------------------
 * Presentation layer only. `envelope.ts` (which renders a paper for a
 * student) calls it. No repository, no write path to content.question, and no
 * scoring path may. If shuffle logic appears inside a query that writes to
 * content.*, that is a bug.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ---------------------------------------
 * It does not touch the correctness path, because it does not have to. This
 * codebase already stores and scores against CANONICAL option ids:
 *
 *   - the envelope serves each option with its real content.question_option.option_id;
 *   - the client posts that same option_id back (frontend/src/pages/TestTakingView.tsx
 *     sends `optionId`, and never a display index or label);
 *   - assess.attempt_response.option_id therefore holds the canonical id;
 *   - submitAttempt scores by comparing that id against the is_correct option
 *     ids, never against a printed label.
 *
 * So reordering the served array cannot move an answer key. The one thing
 * that IS positional is the display label, which this module reassigns to
 * display positions — the option canonically labelled D may print as B in one
 * session and D in the next, which is correct and expected.
 */

/** Bumped whenever the permutation algorithm changes, so old replays stay readable. */
export const SHUFFLE_ALGO_VERSION = 1;

/**
 * Deterministic 32-bit seed from arbitrary string parts (FNV-1a).
 *
 * Deterministic and NOT random on purpose: re-rendering the same question in
 * the same session must show the same order, or the options flicker every
 * time the student scrolls back or the view re-mounts. A different session id
 * produces a different order without anything being stored.
 */
export function seedFrom(...parts: string[]): number {
  let hash = 0x811c9dc5;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      hash ^= part.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hash ^= 0x1f;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** mulberry32 — small, fast, seedable, and identical across runs. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded Fisher-Yates over a COPY. The input array is never mutated. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    const swap = out[i];
    out[i] = out[j];
    out[j] = swap;
  }
  return out;
}

/**
 * Options that must not move, per section 6 of the directive.
 *
 * An option whose text refers to other options BY LABEL is a landmine:
 * shuffling "Both A and B" to a new position, or moving the A and B it names,
 * produces a question with no correct answer. These stay pinned at the end in
 * their original relative order.
 */
const PINNED_PATTERNS: RegExp[] = [
  /^\s*all\s+of\s+the\s+above/i,
  /^\s*none\s+of\s+the\s+above/i,
  /^\s*(all|none)\s+of\s+these/i,
  /^\s*both\s+[a-f]\s+and\s+[a-f]/i,
  /^\s*only\s+[ivx]+(\s+and\s+[ivx]+)*\s*$/i,
  /^\s*(both|neither)\s+.*\s+(and|nor)\s+/i,
  // Any option that names another option's label, e.g. "A and C", "(B) only".
  /\b(?:option\s+)?\(?[A-F]\)?\s+and\s+\(?[A-F]\)?\b/,
  /\ball\s+of\s+the\s+(above|following)\b/i,
];

export function isPinnedOption(text: string): boolean {
  return PINNED_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Options that form a natural ascending numeric sequence.
 *
 * Config flag per the directive, default KEEP IN ORDER: a numeric ladder that
 * has been scrambled reads as a mistake to a student, and the variety gained
 * is worth less than the confusion caused.
 */
export function isNumericLadder(texts: readonly string[]): boolean {
  const numbers = texts.map((text) => {
    const match = text.match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  });
  if (numbers.some(Number.isNaN)) return false;
  const ascending = numbers.every((n, i) => i === 0 || n > numbers[i - 1]);
  const descending = numbers.every((n, i) => i === 0 || n < numbers[i - 1]);
  return ascending || descending;
}

export interface ShuffleOptions {
  /** Default true — leave an ascending/descending numeric option set alone. */
  keepNumericLadders?: boolean;
}

/**
 * The permutation for one question's options: an array of CANONICAL indices
 * in display order. `permutation[displayIndex] === canonicalIndex`.
 *
 * Returns the identity permutation when every option is pinned, when there
 * are fewer than two movable options, or when the set is a numeric ladder and
 * ladders are being kept.
 */
export function optionPermutation(
  optionTexts: readonly string[],
  seed: number,
  options: ShuffleOptions = {}
): number[] {
  const identity = optionTexts.map((_, i) => i);
  if (optionTexts.length < 2) return identity;

  if (options.keepNumericLadders !== false && isNumericLadder(optionTexts)) return identity;

  const pinned: number[] = [];
  const movable: number[] = [];
  optionTexts.forEach((text, index) => {
    if (isPinnedOption(text)) pinned.push(index);
    else movable.push(index);
  });

  if (movable.length < 2) return identity;

  // Pinned options keep their ORIGINAL RELATIVE ORDER at the end, so
  // "All of the above" cannot end up above "None of the above".
  return [...seededShuffle(movable, seed), ...pinned];
}

/** Question order within a set: canonical indices in display order. */
export function questionPermutation(count: number, seed: number): number[] {
  return seededShuffle(
    Array.from({ length: count }, (_, i) => i),
    seed
  );
}

/** Display labels are assigned to POSITIONS, not to options. */
export function labelForPosition(position: number): string {
  return String.fromCharCode(65 + position);
}

/**
 * Apply a permutation to a list, returning a new list. The input is never
 * mutated — the caller's array may be a cached canonical record, and mutating
 * it would leak one session's order into every other session served from the
 * same process.
 */
export function applyPermutation<T>(items: readonly T[], permutation: readonly number[]): T[] {
  return permutation.map((canonicalIndex) => items[canonicalIndex]);
}

/**
 * Map a display position back to its canonical index.
 *
 * The attempt row stores the CANONICAL option id, never a display index. This
 * exists for callers that only have a position — and it is the only correct
 * way to interpret one.
 */
export function canonicalIndexFor(permutation: readonly number[], displayIndex: number): number {
  const canonicalIndex = permutation[displayIndex];
  if (canonicalIndex === undefined) {
    throw new RangeError(
      "display index " + displayIndex + " is outside the permutation of length " + permutation.length
    );
  }
  return canonicalIndex;
}

/**
 * Validate a permutation read back from assess.attempt_question.option_order.
 *
 * A stored permutation is replayed to reconstruct the exact screen a student
 * saw. If it does not match the question's current option count — because the
 * question was edited after the attempt, or because the value was written by
 * a different algorithm version — replaying it would show the WRONG screen
 * and label the student's answer against options they never saw. Falling back
 * to canonical order is the honest failure: the review is then simply
 * unshuffled, rather than confidently wrong.
 */
export function isUsablePermutation(value: unknown, expectedLength: number): value is number[] {
  if (!Array.isArray(value) || value.length !== expectedLength) return false;
  const seen = new Set<number>();
  for (const entry of value) {
    if (!Number.isInteger(entry) || entry < 0 || entry >= expectedLength) return false;
    if (seen.has(entry)) return false;
    seen.add(entry);
  }
  return true;
}
