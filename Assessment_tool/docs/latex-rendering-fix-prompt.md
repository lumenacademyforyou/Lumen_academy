# Superscript/Subscript (Math Notation) — Full System Fix Prompt

You are working on our existing assessment/test-taking web app (React 19 + Vite frontend, Express backend, PostgreSQL). Implement the fix below. Do not rewrite unrelated modules. Follow the existing project structure, state management, and styling conventions.

This has two parts that must both be fixed — fixing only one leaves the problem visible to students:
1. **The frontend has no capability to render math notation at all** (no engine exists).
2. **The source content itself is inconsistently authored** — informal notation, missing braces, invalid grouping, and mislabeled format across the entire live question bank.

---

## Part A — Frontend: no math rendering capability exists

Confirmed by direct code inspection:
- `package.json` has no `katex`, `react-katex`, or `mathjax` dependency.
- Zero matches for `katex`/`mathjax`/`<sup`/`<sub`/`dangerouslySetInnerHTML` anywhere under `frontend/src`.
- Every stem/option/solution renders as a plain string: `frontend/src/pages/TestTakingView.tsx:657` and `frontend/src/pages/AttemptReviewView.tsx:190` both do `{displayQuestionText(currentQuestion.stemText)}` — `displayQuestionText` (`frontend/src/utils/questionText.ts`) only strips leftover template tags, nothing math-related.

**Consequence:** any `^`, `_`, or `sqrt(...)` in content shows to the student as the literal text — never as a real superscript/subscript/root.

---

## Part B — Content audit: the full `new_content` source folder

The live question bank's actual source is `db/content/content-batches/new_content/` — 38 JSON files across 4 subjects (Botany, Chemistry, Physics, Zoology), 1140 questions total, matching every currently-published question in `content.question`. A full scan of every question's `stemText`, every option's `text`, `solution.explanationText`, **and every Tamil translation field** (the raw math notation is copy-pasted verbatim into translations too, untranslated) found:

| Issue | Count (fields) | What it means |
|---|---|---|
| Contains `^` (superscript notation) | 882 | Renders as literal caret + text today |
| Contains `_` (subscript notation) | 392 | Renders as literal underscore + text today |
| `sqrt(...)` function-style notation | 209 | Not LaTeX at all — e.g. `sqrt(l(l+1))`; needs `\sqrt{}` or a real radical, not a literal parenthesized function call |
| Unbraced multi-character exponent | 55 | e.g. `10^15` — even a working renderer would only superscript the "1", not "15"; needs `10^{15}` |
| Parenthesized "exponent" | 51 | e.g. `e^(rt)`, `e^(-Ea / RT)` — invalid grouping; `^` never picks up `(...)`, only `{...}` or one character |
| `stemFormat: "plain"` on a question that actually contains math markup | 339 questions | The content's own format label contradicts its content — schema-level inconsistency, not just a display issue |

**Per-subject severity (questions with at least one issue, out of 30 per file):**
- **Physics — worst, ~74% of questions affected across all 10 chapter files** (21–26 of 30 per file; e.g. `Units & Measurements.json` 26/30, `Thermodynamics & Kinetic Theory.json` 25/30).
- **Chemistry — concentrated in the numeric/physical chapters**: `Chemical Kinetics` 20/30, `Electrochemistry, Solutions & Surface Chem` 18/30, `Some Basic Concepts & States of Matter` 17/30, `Physical Chemistry Equilibrium & Thermodynamics` 17/30, `Atomic Structure & Chemical Bonding` 11/30, `d and f Block Elements` 10/30. The organic-mechanism chapters are almost clean (`Organic Reactions & Mechanisms` 0/30).
- **Botany and Zoology — essentially clean** (0–1 questions per file across all 17 files) — expected, since this content is descriptive, not numeric.

**Representative real examples (question_uid → exact text found):**
- `LMN-CHEM-CHEM09-000016` (stem): *"Rate = P * Z_AB * e^(-Ea / RT)"* — parenthesized exponent, unbraced subscript, no delimiters.
- `LMN-CHEM-CHEM04-000004` (solution): *"1 / lambda = R_H * Z^2 * (1/n1^2 - 1/n2^2)"* — spelled-out `lambda` instead of a symbol, mixed bare exponents.
- `LMN-CHEM-CHEM04-000007` (options A–D): *"sqrt(6) * (h / (2 pi))"* — function-call-style square root, will never look like a root symbol no matter what renders it without a rewrite.
- `LMN-CHEM-CHEM06-000016` (options): *"3.9 * 10^15"* — unbraced multi-digit exponent.
- Every one of the above also appears **verbatim, untranslated, inside the Tamil `translations[].optionTexts`/`stemText`** for that question — the fix must not touch only the English fields.

A reusable audit script now exists at `db/scripts/audit-latex-new-content.mjs` (run with `node db/scripts/audit-latex-new-content.mjs`) — it scans every file under `new_content`, categorizes every issue above, and reports per-file and per-issue counts with examples. **Re-run this after every fix pass** — it's the acceptance check, not just the discovery tool.

---

## Required fix

### 1. Build the rendering capability (frontend)

- Add `katex` (not MathJax — no runtime script execution, smaller bundle, synchronous render) as a frontend dependency, used only for genuine LaTeX-command content (`\frac`, `\sqrt`, `\alpha`, etc. — rare today, but must be supported once content is normalized in step 2).
- Build a shared component (`frontend/src/components/MathText.tsx`) as the default path for the ad hoc `^`/`_` notation that makes up the vast majority of this content:
  - Converts `^`/`_` followed by a `{...}` group, a single character, or a contiguous digit/`+`/`-` run into real `<sup>`/`<sub>`.
  - Detects genuine LaTeX commands and delegates those segments to KaTeX.
  - Runs the existing `displayQuestionText` stripping first, then this conversion.
  - No `dangerouslySetInnerHTML` on unescaped content — build safe DOM nodes / a tightly scoped renderer.
- Replace both render sites (`TestTakingView.tsx`, `AttemptReviewView.tsx`) — audit both for **option-text and explanation-text** render spots too, not just the stem. Cover the Tamil (`stemTextTa`/translated option) render path identically — it carries the same math notation.

### 2. Normalize the content (all 38 files under `new_content`)

For every field flagged by `audit-latex-new-content.mjs`:
- Brace every multi-character exponent/subscript: `10^15` → `10^{15}`, `n1^2` → `n_1^2` (note: also fix the missing subscript-vs-plain-number ambiguity — `n1` should be `n_1` if it means "n subscript 1", not a bare unbraced token).
- Rewrite every parenthesized "exponent" as valid LaTeX grouping: `e^(rt)` → `e^{rt}`, `e^(-Ea / RT)` → `e^{-E_a / RT}`.
- Rewrite every `sqrt(...)` function-call-style occurrence as `\sqrt{...}`: `sqrt(l(l+1))` → `\sqrt{l(l+1)}`.
- Replace spelled-out Greek/symbol words used inline with actual LaTeX where the surrounding text is otherwise math (`lambda` → `\lambda`, `pi` → `\pi`) — but only inside math segments, not in plain prose.
- Correct `stemFormat` (and by extension `solutionFormat`) to `"latex"` on every one of the 339 mismatched questions, since the content is not plain text.
- **Apply every fix to the Tamil `translations[]` entries too** — do not leave the English field fixed while the Tamil copy still has the old broken notation.
- Do this as a scripted, re-runnable transform (not manual hand-editing 1140 questions) — write it to read each file, apply the normalization rules, and write it back, so it's reviewable as a diff and repeatable if more content arrives in the same shape. Keep the transform separate from the audit script (audit reports, transform fixes) so either can be run independently.
- Work subject-by-subject in priority order: **Physics first** (worst, ~74% affected), then the 6 flagged Chemistry chapters, then spot-check the handful of Botany/Zoology hits. Do not silently touch a file the audit reports as 0/30.

### 3. Re-import / re-sync the live database

Once `new_content` is fixed, the live `content.question`/`question_option`/`question_solution`/`question_translation` rows (currently 1140 published, sourced from these same files) need to be updated to match — check whichever importer/update path this repo currently uses for `new_content` (find it before assuming a new one is needed) and re-run it, rather than leaving the source files fixed but the live database still serving the old broken text.

### 4. Prevent recurrence

- Update `schemas/question-authoring.schema.ts`'s authoring documentation to spell out the exact required syntax: multi-character exponents/subscripts must always be `{}`-braced, `\sqrt{}` not `sqrt()`, real LaTeX commands for Greek letters/symbols, and that `stemFormat`/`solutionFormat` must be set to `"latex"` whenever any of this appears — not left as `"plain"`.

---

## Verification — done when

- `node db/scripts/audit-latex-new-content.mjs` run against `new_content` reports **zero** `unbraced_multichar_exponent`, `paren_exponent`, and `sqrt_function_style` hits, and **zero** `stemFormatMismatch` entries.
- A sample from each of Physics (worst), the 6 affected Chemistry chapters, and the few Botany/Zoology hits renders real superscript/subscript/root characters in the browser — spot-check both English and Tamil.
- The live database reflects the same fixed text as the source files (no drift between `new_content` and what's actually served).
- A plain-text question with no math markup at all (the majority of Botany/Zoology) is byte-for-byte unaffected — regression check.
- Unit test: given `"10^{15}"` input to `MathText`, assert the rendered output contains a real `<sup>` node, not the literal string.

## Deliverable

For each part: which files were touched, the library added and why, the transform script used for content normalization (kept in the repo, not a one-off), the re-import path used to sync the live DB, and a before/after for at least `LMN-CHEM-CHEM09-000016` and `LMN-CHEM-CHEM04-000007` (both English and Tamil).
