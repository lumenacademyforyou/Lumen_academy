import fs from "node:fs";
import path from "node:path";

// docs/latex-rendering-fix-prompt.md Part B — one re-runnable transform that
// normalises the ad hoc math notation across db/content/content-batches/new_content
// into something a renderer can actually typeset, in English *and* in the
// Tamil translations[] (which duplicate the same formulae verbatim).
//
// Companion to db/scripts/audit-latex-new-content.mjs: that one reports, this
// one fixes, and the audit is the acceptance check after every run.
//
//   node db/scripts/normalize-latex-new-content.mjs            # dry run (default)
//   node db/scripts/normalize-latex-new-content.mjs --write    # rewrite files in place
//   node db/scripts/normalize-latex-new-content.mjs --write --only Physics
//
// Dry run by default, matching db/scripts/import/import-content.ts's
// convention. The review artefact is `git diff` on the content files, so the
// writer preserves each file's existing 2-space JSON layout, its CRLF-or-LF
// line endings and its trailing-newline-or-not exactly (verified: all 38
// files round-trip byte-for-byte through JSON.parse/stringify), and a file
// whose questions are already clean is never rewritten at all.
//
// Every rule below is idempotent — running twice changes nothing on the
// second pass — which is what makes it safe to re-run over already-fixed
// content when new batches land.

const ROOT = path.resolve("db/content/content-batches/new_content");

// Priority order from the fix prompt: Physics is worst (~74% of questions),
// then the flagged Chemistry chapters, then Botany/Zoology as a spot check.
const SUBJECT_PRIORITY = ["Physics", "Chemistry", "Botany", "Zoology"];

// ---------------------------------------------------------------------------
// Text transforms
// ---------------------------------------------------------------------------

/** Reads a balanced (...) starting at `open` (index of the "("). Null if unbalanced. */
function readParenGroup(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) return { body: s.slice(open + 1, i), end: i + 1 };
    }
  }
  return null;
}

/** "sqrt(l(l + 1))" -> "\sqrt{l(l + 1)}". Balanced-paren aware; nested calls handled by the outer loop. */
function rewriteSqrtCalls(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    // Only a bare `sqrt(` call — never the `\sqrt{` this rule already produced.
    const m = /^sqrt\s*\(/i.exec(s.slice(i));
    const isWordStart = i === 0 || !/[A-Za-z0-9\\]/.test(s[i - 1]);
    if (m && isWordStart) {
      const group = readParenGroup(s, i + m[0].length - 1);
      if (group) {
        out += "\\sqrt{" + rewriteSqrtCalls(group.body) + "}";
        i = group.end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

/** "e^(-Ea / RT)" -> "e^{-Ea / RT}", "f_(n+1)" -> "f_{n+1}". Balanced-paren aware. */
function rewriteParenScripts(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    if ((s[i] === "^" || s[i] === "_") && s[i + 1] === "(") {
      const group = readParenGroup(s, i + 1);
      if (group) {
        out += s[i] + "{" + group.body + "}";
        i = group.end;
        continue;
      }
    }
    out += s[i];
    i++;
  }
  return out;
}

// Exponent bodies are a *pure* digit run or a *pure* letter run, never mixed.
// That is what keeps "d^2U/dx^2" as d²U/dx² instead of misreading it as
// d^{2U}, while still bracing "10^15", "^238" and "^Delta".
//   ^-1     -> ^{-1}     (signed)
//   ^1.4    -> ^{1.4}    (decimal; a "." not followed by a digit is a full stop)
//   ^2-     -> ^{2-}     (ion charge: trailing sign only after a digit run,
//                         and only when a word character does not follow, so
//                         "x^2-y" keeps its minus as subtraction)
//   ^2U     -> ^{2}U      (the charge group must stay *optional* here rather
//                          than failing the whole match, so "d^2U/dx^2" is
//                          still seen as an exponent of 2 followed by a U)
const EXPONENT = /\^(?!\{)([+-]?)(?:(\d+(?:\.\d+)?)((?:[+-](?![A-Za-z0-9]))?)|([A-Za-z]+))/g;

/**
 * Braces any exponent whose body is more than one character. Single chars
 * ("^2", "^n", "^-") are left bare — except where a letter follows straight
 * on, as in "d^2U/dx^2", where the brace is the only thing that says the
 * exponent stopped at the 2 and the U is the function. Bracing that one keeps
 * it reading as d²U/dx² *and* clears the audit's unbraced-exponent regex,
 * which cannot tell "^2U" (correct) from "^15" (broken) on its own.
 */
function braceExponents(s) {
  return s.replace(EXPONENT, (whole, sign, digits, charge, letters, offset, full) => {
    const body = digits !== undefined ? sign + digits + (charge || "") : sign + letters;
    const followedByLetter = /[A-Za-z]/.test(full[offset + whole.length] ?? "");
    return body.length > 1 || followedByLetter ? `^{${body}}` : whole;
  });
}

// Subscript bodies read the other way round, because subscripts here are
// variable names rather than numbers:
//   letter-led  -> letters then optional digits   ("_max", "_v1", "_SO2")
//   digit-led   -> the digit run only             ("_92U" -> "_{92}U", nuclear
//                  notation), except for a µ-prefixed unit ("_2μF").
const SUBSCRIPT = /_(?!\{)(?:([A-Za-z]+\d*)|(\d+(?:μ[A-Za-z]+)?))/g;

/** Braces any subscript whose body is more than one character. */
function braceSubscripts(s) {
  return s.replace(SUBSCRIPT, (whole, word, num) => {
    const body = word !== undefined ? word : num;
    return body.length > 1 ? `_{${body}}` : whole;
  });
}

/**
 * "1/n1^2" -> "1/n_1^2". Scoped hard: a *word-initial* single letter followed
 * by one digit and immediately by "^". The word-boundary requirement is what
 * excludes chemical formulae — "CrO4^2-", "CO3^2-", "Cr2O7^2-", "C2H5^" all
 * have a word character before the letter and are left alone.
 *
 * ELEMENT_SYMBOLS then excludes the formulae that ARE word-initial. In this
 * bank that is only "O2^2-" (molecular oxygen), but the whole set of common
 * single-letter symbols is listed rather than just O, so a later batch adding
 * "N2^...", "H2^..." or "S2^..." does not silently start subscripting
 * molecules. Physics variables (A1, V1, r1, v1, t1, n1) are unaffected.
 */
const ELEMENT_SYMBOLS = new Set(["H", "N", "O", "F", "S", "C", "P"]);
function subscriptVariableIndices(s) {
  return s.replace(/\b([A-Za-z])(\d)\^/g, (whole, letter, digit) =>
    ELEMENT_SYMBOLS.has(letter) ? whole : `${letter}_${digit}^`
  );
}

/**
 * Spelled-out symbols, *only* where the surrounding characters are math.
 *
 * "lambda" never appears as English prose in this bank (it is always a
 * wavelength), so it converts on a plain word boundary. "pi" very much does —
 * "pi bonds", "pi-electrons", "pi* antibonding", "ring-pi donation" are all
 * chemistry prose — so it converts only when it sits directly after a digit,
 * "(" or "/" AND is not followed by "-", "*" or a word character. That
 * catches "(4 pi)", "h / 2pi", "8/pi", "4 pi v" and leaves every prose use.
 * Both guard against a preceding backslash so re-runs are no-ops.
 */
function rewriteSpelledSymbols(s) {
  let out = s.replace(/(?<!\\)\blambda\b/g, "\\lambda");
  // No leading \b: "h / 2pi" has no word boundary between the digit and the
  // "p". The lookbehind does that job instead, and the trailing guard is what
  // rejects "pi2px", "pi-electrons", "pi*" and "pituitary".
  out = out.replace(/(?<=\d\s?|[/(]\s?)(?<!\\)pi(?![-*\w])/g, "\\pi");
  return out;
}

/** The full pipeline. Order matters: sqrt/paren groups are resolved before anything looks at bare ^ and _. */
export function normalizeMath(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  let s = text;
  s = rewriteSqrtCalls(s);
  s = rewriteParenScripts(s);
  s = subscriptVariableIndices(s);
  s = braceExponents(s);
  s = braceSubscripts(s);
  s = rewriteSpelledSymbols(s);
  return s;
}

// ---------------------------------------------------------------------------
// Question-level pass
// ---------------------------------------------------------------------------

// Kept deliberately in step with audit-latex-new-content.mjs's own
// "questionHasMathMarkup" test — the audit's stemFormatMismatch check is
// per-question and looks at every field (stem, options, solution, all
// translations), so the format flags have to be set on the same per-question
// basis for the audit to reach zero.
const MATH_MARKUP = /[\^_]|\\[a-zA-Z]+|sqrt\(/i;

function questionHasMath(q) {
  const fields = [q.stemText, q.solution?.explanationText];
  for (const o of q.options ?? []) fields.push(o.text);
  for (const t of q.translations ?? []) {
    fields.push(t.stemText);
    for (const ot of t.optionTexts ?? []) fields.push(ot);
  }
  return fields.some((f) => typeof f === "string" && MATH_MARKUP.test(f));
}

/** Rewrites one question in place. Returns the number of fields whose text changed. */
function normalizeQuestion(q, stats) {
  let changed = 0;
  const apply = (obj, key) => {
    const before = obj[key];
    if (typeof before !== "string") return;
    const after = normalizeMath(before);
    if (after !== before) {
      obj[key] = after;
      changed++;
      if (stats.samples.length < 12 && before.length < 220) stats.samples.push({ uid: q.questionUid, key, before, after });
    }
  };

  apply(q, "stemText");
  if (q.solution) apply(q.solution, "explanationText");
  for (const o of q.options ?? []) apply(o, "text");
  for (const t of q.translations ?? []) {
    apply(t, "stemText");
    if (Array.isArray(t.optionTexts)) {
      for (let i = 0; i < t.optionTexts.length; i++) {
        const before = t.optionTexts[i];
        const after = normalizeMath(before);
        if (after !== before) {
          t.optionTexts[i] = after;
          changed++;
        }
      }
    }
  }

  // Format flags last, so they reflect the normalised text.
  let flagged = 0;
  if (questionHasMath(q)) {
    if (q.stemFormat !== "latex") {
      q.stemFormat = "latex";
      flagged++;
    }
    if (q.solution && q.solution.solutionFormat !== "latex") {
      q.solution.solutionFormat = "latex";
      flagged++;
    }
  }
  stats.formatFlagsSet += flagged;
  return changed + flagged;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function listJsonFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

function subjectOf(file) {
  const rel = path.relative(ROOT, file);
  return rel.split(path.sep)[0];
}

function main() {
  const write = process.argv.includes("--write");
  const onlyIndex = process.argv.indexOf("--only");
  const only = onlyIndex >= 0 ? process.argv[onlyIndex + 1] : null;

  let files = listJsonFiles(ROOT);
  if (only) files = files.filter((f) => subjectOf(f).toLowerCase() === only.toLowerCase());
  files.sort((a, b) => {
    const sa = SUBJECT_PRIORITY.indexOf(subjectOf(a));
    const sb = SUBJECT_PRIORITY.indexOf(subjectOf(b));
    return sa !== sb ? sa - sb : a.localeCompare(b);
  });

  const stats = { formatFlagsSet: 0, samples: [] };
  let filesChanged = 0;
  let questionsChanged = 0;
  const perFile = [];

  for (const file of files) {
    const raw = fs.readFileSync(file, "utf-8");
    const arr = JSON.parse(raw);
    let touched = 0;
    for (const q of arr) if (normalizeQuestion(q, stats) > 0) touched++;

    if (touched === 0) {
      // "Don't touch files the audit reports as 0/30" — falls out of this
      // rather than out of a hard-coded skip list.
      perFile.push({ file: path.relative(process.cwd(), file), questionsChanged: 0 });
      continue;
    }

    let out = JSON.stringify(arr, null, 2);
    if (raw.includes("\r\n")) out = out.replace(/\n/g, "\r\n");
    if (raw.endsWith("\r\n")) out += "\r\n";
    else if (raw.endsWith("\n")) out += "\n";

    if (out !== raw) {
      if (write) fs.writeFileSync(file, out, "utf-8");
      filesChanged++;
      questionsChanged += touched;
    }
    perFile.push({ file: path.relative(process.cwd(), file), questionsChanged: touched });
  }

  console.log(write ? "MODE: --write (files rewritten in place)" : "MODE: dry run (no files written; pass --write to apply)");
  console.log(`files scanned:      ${files.length}`);
  console.log(`files changed:      ${filesChanged}`);
  console.log(`questions changed:  ${questionsChanged}`);
  console.log(`format flags set:   ${stats.formatFlagsSet}`);
  console.log("\nper file:");
  for (const f of perFile) console.log(`  ${String(f.questionsChanged).padStart(3)}  ${f.file}`);

  if (stats.samples.length) {
    console.log("\nsample rewrites:");
    for (const s of stats.samples) {
      console.log(`\n  ${s.uid} · ${s.key}`);
      console.log(`    before: ${s.before}`);
      console.log(`    after:  ${s.after}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("normalize-latex-new-content.mjs")) {
  main();
}
