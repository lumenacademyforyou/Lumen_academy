/**
 * questionArtifacts — the one place that knows what a generator/template
 * artifact looks like inside a question stem, and how to remove it.
 *
 * docs/test-engine-fix-prompt.md Defect 1. The live bank was found (this
 * session, by querying content.question directly rather than assuming the
 * report's shape) to carry 73 published rows whose stem_text ends in — or
 * contains — a template identifier that was never meant to be user-facing:
 *
 *   "…conservation laws in Current Electricity (case #14_2)?"
 *   "…the power of a plane glass plate of infinite radius of curvature #16_2?"
 *   "…B(y) = B₀ (1 + k y) k̂ (case #2). What is the steady terminal…"
 *
 * plus the same 46 stems again in content.question_translation.
 *
 * Mirrored byte-for-byte in SQL as content.fn_strip_question_artifacts
 * (db/migrations/036_strip_template_artifacts.sql), the same discipline
 * normalizeStem.ts / content.fn_normalize_stem already follow in this repo.
 * db/content/question-artifacts.test.ts asserts the two agree on every
 * artifact-bearing stem in the live bank, not just hand-picked fixtures.
 * If you change a step here, change it there too, in the same order.
 *
 * Deliberate narrowing versus the spec's own suggested regex, which matched
 * a bare `\d+[_\-.]\d+` with no marker at all: that shape is genuinely
 * indistinguishable from real content (a decimal, a ratio, a subscripted
 * range) and would silently mangle legitimate stems. Every artifact is
 * required here to carry either the literal word `case` or a `#`. Verified
 * against the live bank before narrowing: zero rows match `\d+_\d+` without
 * one of those two markers, and every one of the 73 stems containing a `#`
 * at all is an artifact — so nothing real is missed and nothing real is at
 * risk.
 */

/**
 * A bracketed tag: " (case #5_0)", " [case 5_0]", " (#5_0)", " (case #2)".
 *
 * The `case`/`#` marker is REQUIRED, matching this file's stated contract
 * ("Every artifact is required here to carry either the literal word `case`
 * or a `#`"). It used to be optional — `(?:case[ \t]*)?#?` — which made the
 * pattern match any bracketed bare number and contradicted the contract the
 * header documents. That went unnoticed because the old bank contained no
 * such text, but it is not a safe rule: a bracketed bare number is ordinary
 * content. Measured on the 2026-09-02 bank, the optional form rejected 89 of
 * 1140 questions and, had they been stripped rather than rejected, would have
 * deleted publication years — "Five Kingdom Classification (1969)",
 * "W.M. Stanley (1935)", "Schleiden (1838) and Schwann (1839)" — and
 * mathematical notation such as sqrt(2) and sin^-1(0.6).
 *
 * Mirrored in content.fn_strip_question_artifacts
 * (db/migrations/047_artifact_marker_required.sql).
 */
const BRACKETED_TAG = /[ \t]*[([][ \t]*(?:case[ \t]*#?|#)[ \t]*\d+(?:[_.-]\d+)?[ \t]*[)\]]/gi;

/** An unbracketed tag carrying the literal word "case": "… case#5_0", "… case 5_0". */
const CASE_WORD_TAG = /[ \t]*case[ \t]*#?[ \t]*\d+(?:[_.-]\d+)?/gi;

/** An unbracketed hash tag: "… radius of curvature #16_2?". The `#` is required. */
const HASH_TAG = /[ \t]*#[ \t]*\d+(?:[_.-]\d+)?/g;

/**
 * A trailing unit-name suffix — "… — Electrostatic Potential and Capacitance".
 * Built from a caller-supplied unit-name list (never hardcoded; the caller
 * reads catalog.syllabus_node). Zero rows in this bank match it today, but
 * the spec calls for it and a future importer could reintroduce it.
 */
function unitSuffixPattern(unitNames: readonly string[]): RegExp | null {
  if (unitNames.length === 0) return null;
  const alternation = unitNames
    .filter((n) => n.trim().length > 0)
    .map((n) => n.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .sort((a, b) => b.length - a.length) // longest-first so a prefix name can't win over a longer one
    .join("|");
  if (alternation.length === 0) return null;
  return new RegExp(`[ \\t]*[—–\\-|:][ \\t]*(?:${alternation})[ \\t]*(?=[?.:]?[ \\t]*$)`, "i");
}

/**
 * True when `text` still carries an artifact. Used by the write-time guard
 * (db/content/question-write-guard.ts) and by the migration's verify script.
 */
export function hasQuestionArtifact(text: string | null | undefined, unitNames: readonly string[] = []): boolean {
  if (!text) return false;
  return stripQuestionArtifacts(text, unitNames) !== text;
}

/**
 * Removes every template artifact from a stem. Idempotent: running it on
 * already-clean text returns the input unchanged, byte for byte, including
 * its original whitespace/newlines — the tidy-up pass only runs when
 * something was actually removed, so a clean multi-line stem is never
 * silently reflowed by this function.
 */
export function stripQuestionArtifacts(input: string, unitNames: readonly string[] = []): string {
  let s = input;
  let previous: string;

  // Repeat until stable — "… (case #5_0) (case #5_1)?" needs more than one pass.
  do {
    previous = s;
    s = s.replace(BRACKETED_TAG, "");
    s = s.replace(CASE_WORD_TAG, "");
    s = s.replace(HASH_TAG, "");
    const unitSuffix = unitSuffixPattern(unitNames);
    if (unitSuffix) s = s.replace(unitSuffix, "");
  } while (s !== previous);

  if (s === input) return input;

  // Tidy only what the removal itself broke: an orphaned space before the
  // sentence's own punctuation, and doubled spaces where a tag used to sit.
  // Deliberately [ \t] and not \s — newlines in a real multi-line stem must
  // survive this untouched.
  s = s.replace(/[ \t]+([?.:,;])/g, "$1");
  s = s.replace(/[ \t]{2,}/g, " ");
  return s.trim();
}
