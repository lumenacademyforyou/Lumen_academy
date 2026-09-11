# CL-1 — Content authoring contract (v1.0)

**Frozen:** 26-08-2026, 11:00 IST (LA-PLAN-002 gate G1). **Owner:** Santhosh. **Amendments** land as
v1.1+ below, never a silent edit — if something here doesn't match what the source material can
actually supply, that's exactly what the 11:00–12:00 contract review is for.

Machine-checkable version: `schemas/question-authoring.schema.ts` (a Zod schema — the importer
validates against this exact file, so "does my file pass?" always has one answer). Three worked
examples in `schemas/samples/`. Run `npx tsx schemas/validate-samples.ts` to check any file.

A batch file is a **JSON array of questions** — one file per batch (e.g. `batch-1-physics.json`),
one array element per question.

## Field reference

| Field | Required? | Type | Notes |
|---|---|---|---|
| `questionUid` | yes | string | See naming convention below. You assign this per question. |
| `examCode` | yes | string | `"NEET"` for now. |
| `subjectCode` | yes | string | `PHY`, `CHEM`, `BOT`, or `ZOO`. |
| `nodeTagCode` | yes | string | Which syllabus unit this question belongs to — e.g. `phy_01`. Ask Santhosh for the current list if you don't have it; it must match a real row, not a free-text chapter name. |
| `questionType` | yes | enum | `single_choice`, `multi_choice`, `integer`, `numeric`, `matrix_match`, `assertion_reason`, `true_false`. Matrix-match questions are accepted by the schema but **not scored by the engine yet** — don't author these until told otherwise. |
| `difficultyBand` | no | `easy`/`medium`/`hard` | Best guess is fine; this isn't exam-certified difficulty. |
| `stemFormat` | no (default `latex`) | `plain`/`markdown`/`latex`/`html` | Use `plain` if there's no math in the question at all — simpler to review. Use `latex` when there's math: wrap inline math in `$...$`. |
| `stemText` | yes | string | The question itself. |
| `options` | required unless `numeric`/`integer` | array, 2-6 entries | Each: `{ "label": "A", "text": "...", "isCorrect": true/false }`. Exactly one `isCorrect: true` for `single_choice`/`true_false`/`assertion_reason`; one or more for `multi_choice`. |
| `numericAnswer` | required for `numeric`/`integer` | string | **String, not a number** — e.g. `"0.52"` not `0.52`. Numeric questions must not have `options`. |
| `answerTolerance` | no | string | Acceptable margin either side of `numericAnswer`, as a string, e.g. `"0.01"`. Leave it out if the answer must match exactly. |
| `solution.explanationText` | yes | string | Why the answer is correct. This is what the student sees after submitting, not before. |
| `solution.formulaReference` | no | string | e.g. `"NCERT Physics Class XI, Ch. 7"`. |
| `images` | no | array | See below. |
| `translations` | no | array | See below. English is always the top-level `stemText`/`options` — only *other* languages go here. |

## `questionUid` naming convention

```
LMN-<SUBJECT_CODE>-<NODE_CODE>-<6-digit serial>
```

- `SUBJECT_CODE` — same as the `subjectCode` field, upper-case.
- `NODE_CODE` — the `nodeTagCode`, upper-cased with the underscore removed (`phy_01` → `PHY01`).
- Serial — just pick the next number in sequence for that subject+node as you author (`000101`,
  `000102`, ...). If two files end up with the same number, the importer will tell you — it's not a
  disaster, just rename and re-run.

**Example:** `LMN-PHY-PHY01-000101` — a Physics question tagged to node `phy_01`.

The importer double-checks that the subject segment of `questionUid` matches `subjectCode` — a
copy-paste mistake (wrong prefix) gets caught before it ever reaches the database.

## Images

```json
"images": [
  { "fileName": "phy01-disc-tangential-force.png", "altText": "...", "targetRole": "stem" }
]
```

- `fileName` must match a file you actually place in the shared upload folder — the importer doesn't
  fetch images from anywhere, it just links what you've already put there.
- `targetRole` is `stem` (attached to the question itself), `option` (attached to one specific
  option — then also set `optionLabel`), or `solution`.
- Storage is Supabase Storage (not Google Drive) — CL-3 handles the actual upload; you just need the
  filename to match.

## Translations

```json
"translations": [
  { "languageCode": "ta", "stemText": "...", "optionTexts": ["...", "...", "...", "..."] }
]
```

`optionTexts`, if present, must have exactly as many entries as the top-level `options` array, in
the same A/B/C/D order.

## Worked examples

See `schemas/samples/`:

- `sample-01-image.json` — a `single_choice` Physics question with a stem image.
- `sample-02-latex-numeric.json` — a `numeric` Chemistry question with LaTeX in the stem.
- `sample-03-tamil-translation.json` — a `single_choice` Botany question with a Tamil translation.

## What the schema will reject (and why that's useful, not annoying)

- A `single_choice` question with zero or more-than-one correct option.
- A `numeric`/`integer` question that also has `options` (pick one shape or the other).
- `numericAnswer`/`answerTolerance` written as a bare number instead of a string (`0.52` instead of
  `"0.52"`) — this project never uses floating-point for anything that affects a score (R-11), so the
  contract enforces "always a string" from the very first place a number enters the system.
- `questionUid`'s subject prefix not matching `subjectCode`.
- A translation's `optionTexts` with the wrong number of entries.

Every rejection names the exact field and reason — run `npx tsx schemas/validate-samples.ts` (or the
equivalent dry-run once CL-2 exists) to see this before a batch ever reaches the live database.

## Amendments

*(none yet — v1.0 is the initial freeze)*
