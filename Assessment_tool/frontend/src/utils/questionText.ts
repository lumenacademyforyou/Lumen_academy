/**
 * Display-layer defence in depth for template artifacts leaking into a
 * question stem — docs/test-engine-fix-prompt.md Defect 1, requirement 5.
 *
 * The real fix is in the data: migration 036 stripped every artifact out of
 * content.question / question_translation / question_option, and a pair of
 * write-time triggers (plus an import-layer check) stop one being written
 * back. This is the belt to that braces, and nothing more — the spec is
 * explicit that "sanitising on render while the DB stays dirty is not an
 * acceptable fix on its own", and it isn't the fix here either.
 *
 * Kept deliberately in lockstep with db/shared/questionArtifacts.ts's
 * patterns. It is a small, self-contained copy rather than an import because
 * frontend/ builds through Vite and does not pull from db/; if you change the
 * patterns there, change them here.
 */
const BRACKETED_TAG = /[ \t]*[([][ \t]*(?:case[ \t]*)?#?[ \t]*\d+(?:[_.-]\d+)?[ \t]*[)\]]/gi;
const CASE_WORD_TAG = /[ \t]*case[ \t]*#?[ \t]*\d+(?:[_.-]\d+)?/gi;
const HASH_TAG = /[ \t]*#[ \t]*\d+(?:[_.-]\d+)?/g;

/**
 * Strips any surviving generator/template identifier from text about to be
 * shown to a student. Returns clean input byte-for-byte unchanged, so it is
 * safe to wrap every render site with it.
 */
export function displayQuestionText(input: string): string;
export function displayQuestionText(input: null | undefined): null;
export function displayQuestionText(input: string | null | undefined): string | null;
export function displayQuestionText(input: string | null | undefined): string | null {
  if (input == null) return null;

  let s = input;
  let previous: string;
  do {
    previous = s;
    s = s.replace(BRACKETED_TAG, "").replace(CASE_WORD_TAG, "").replace(HASH_TAG, "");
  } while (s !== previous);

  if (s === input) return input;
  return s
    .replace(/[ \t]+([?.:,;])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
