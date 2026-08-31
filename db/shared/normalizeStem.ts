import crypto from "node:crypto";

/**
 * docs/no-repeat-questions-fix.md Phase 1.1 — the one normalizer, mirrored
 * byte-for-byte in SQL as content.fn_normalize_stem (db/migrations/030_
 * question_fingerprints.sql). The two must never drift: db/content/
 * fingerprint-normalizer.test.ts asserts they agree on every real stem in
 * the live bank, not just a handful of hand-picked fixtures. If you change
 * a step here, change it there too, in the same order.
 *
 * \x01 is used internally as a placeholder while protecting a decimal
 * point's dot from the punctuation-strip step — it cannot appear in real
 * input (stripped by step 2 like every other control character) so there is
 * no collision risk.
 */
const PLACEHOLDER = "\x01";

export function normalizeStem(input: string): string {
  let s = input.normalize("NFKC");

  // 2. Strip HTML tags and markdown formatting/link syntax.
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  s = s.replace(/[*_~`]/g, "");
  s = s.replace(/^\s*#+\s*/gm, "");

  // 3. Strip LaTeX spacing tokens and collapse $$/$ delimiters.
  s = s.replace(/\\,|\\!|\\;|\\quad|\\qquad/g, " ");
  s = s.replace(/\$+/g, "");

  // 4. Strip leading enumeration ("1.", "(2)", "[3]" at the start).
  s = s.replace(/^\s*[([]?\d+[)\].:]\s*/, "");

  // 5. Lowercase.
  s = s.toLowerCase();

  // 6. Strip punctuation except decimal points inside numbers and math operators.
  s = s.replace(/(\d)\.(\d)/g, `$1${PLACEHOLDER}$2`);
  s = s.replace(/[^a-z0-9\s+\-*/=<>\x01]/g, "");
  s = s.replace(new RegExp(PLACEHOLDER, "g"), ".");

  // 7. Normalize unit spacing ("5kg" -> "5 kg").
  s = s.replace(/(\d)([a-z])/g, "$1 $2");

  // 8. Collapse whitespace, trim.
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

const UNIT_SEP = "\x1f";

/** sha256(norm(stem) || US || sorted(norm(option))...) — the enforced dedup key (Phase 1.2). */
export function computeContentFp(stemText: string, optionTexts: string[]): Buffer {
  const normalizedOptions = optionTexts.map(normalizeStem).sort();
  const payload = [normalizeStem(stemText), ...normalizedOptions].join(UNIT_SEP);
  return crypto.createHash("sha256").update(payload, "utf8").digest();
}

/** sha256(norm(stem)) — catches the same stem re-authored with different options. */
export function computeStemFp(stemText: string): Buffer {
  return crypto.createHash("sha256").update(normalizeStem(stemText), "utf8").digest();
}

/** sha256(norm(stem) with digits collapsed to '#') — numeric-variant detector, report-only per Phase 1.4. */
export function computeSkeletonFp(stemText: string): Buffer {
  const skeleton = normalizeStem(stemText).replace(/\d+(\.\d+)?/g, "#");
  return crypto.createHash("sha256").update(skeleton, "utf8").digest();
}
