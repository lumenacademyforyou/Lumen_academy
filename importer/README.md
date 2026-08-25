# Lumen Academy question importer (Task 4)

Takes a finished question in the v3 block-storage shape, checks it's
well-formed, checks it's tagged to a real reachable topic, and loads it
into the database for real — or, with `--dry-run`, does every one of those
checks and reports what would happen without writing a single row.

This is the last of the four-part delivery plan: (1) Physics/Chemistry
concept trees, (2) Botany/Zoology/Mathematics concept trees, (3) full
syllabus mapping bridging every topic to every exam, (4) this importer.

## Setup

```bash
npm install
cp .env.example .env
# edit .env — DATABASE_URL must point at a database that already has the
# full schema chain loaded (see "Database prerequisites" below)
export $(grep -v '^#' .env | xargs)   # or use direnv / dotenv-cli
```

## Usage

```bash
# Report every problem, write nothing:
npx tsx import-questions.ts --file path/to/questions.json --dry-run

# Import for real — each question is its own transaction, so a mid-batch
# failure only rolls back that one question, not the whole file:
npx tsx import-questions.ts --file path/to/questions.json

# Write the report somewhere specific instead of next to the input file:
npx tsx import-questions.ts --file path/to/questions.json --dry-run --report /tmp/report.json
```

The input file is a JSON array (or a single object) of questions in the
shape `generate-questions.ts` writes to `../gemini-question-gen/generated/`.
`fixtures/` has worked examples of every case below.

Every run prints one verdict per question — `IMPORTED` / `WOULD_IMPORT` /
`REJECTED` — with the exact reasons for a rejection, and also writes the
same result set as JSON next to the input file (or wherever `--report`
points).

## Database prerequisites

The importer assumes this exact chain has already been run, in order,
against `DATABASE_URL`:

1. `010_question_model.sql` — **never included in the uploaded kit**, only
   referenced as a prerequisite everywhere else. Until the real file
   surfaces, use `010_question_model.RECONSTRUCTED.sql` in this directory —
   read its header before trusting it against anything but a scratch
   database; every table/column in it is marked CONFIRMED (seen in a real
   `insert` in the block-template demos) or INFERRED (a reasonable guess,
   not a fact).
2. `000_template_helpers.sql`
3. `012_question_variant.sql` (the real file, from the uploaded kit — do
   **not** skip this: the reconstruction deliberately leaves
   `variant_of_question_id` etc. off `content.question`'s initial
   `CREATE TABLE` so this file's `ALTER TABLE` statements are the ones
   that add them, matching how the real kit splits the file)
4. All five `*.concept-tree.sql` files
5. All three `*.exam-template.sql` files
6. All three `*.syllabus.sql` files

All of this has been run end-to-end against a real local Postgres 16
instance as part of building this importer — not just statically reviewed —
and two real bugs turned up doing that, both already fixed in the
uploaded-kit files themselves (not just worked around here):

- Every `*.syllabus.sql` file was missing the depth-1 subject-level root
  syllabus node for every subject except the one the matching
  `*.exam-template.sql` file happened to demo — `upsert_syllabus_node`
  requires a node's parent to already exist, so e.g. `CHE/U01` failed with
  "Parent CHE does not exist yet" the first time this was actually run
  against a database. Fixed by adding one `upsert_syllabus_node(..., 'CHE',
  'Chemistry', 'subject', 1, null)`-style root line per subject.
- The concept trees mark both chapters (depth 3) and topics (depth 4) as
  taggable, but the syllabus files only ever mapped topics via
  `map_node_concept` — leaving 95 taggable chapter-level concepts with zero
  exam reachability. Fixed by adding one chapter-level `map_node_concept`
  call per chapter, derived 1:1 from the existing topic-level mappings.

After both fixes, `select count(*) from (...)` for "taggable concept with
no mapped syllabus node" returns 0 across all three exams — full coverage,
confirmed live, not just asserted.

`010_question_model.RECONSTRUCTED.sql` also picked up two corrections found
the same way: `content.asset` was missing the `byte_size` column that
`image.block-template.sql` actually inserts, and nothing enforced that
comment's own claim that alt_text is "compulsory ... enforced by
constraint" for a visual block. Every one of the seven real
`*.block-template.sql` demo files (`text`, `latex`, `equation`, `table`,
`image`, `graph`, `circuit`) now runs clean against the reconstruction.

## What "well-formed" checks (no database needed)

- every required field present, right type/enum
- every content block is one of the four confirmed families — text/latex,
  named equation, table/dataset, or an asset-backed visual — matching what
  that family's own `*.block-template.sql` demo actually inserts
- a visual block always carries `altText`
- block `seq` within a language lane is a contiguous `1..N`
- option `displayOrder` is contiguous `1..N`, labels are unique
- `MCQ_SINGLE` has exactly 1 correct option; `MCQ_MULTIPLE` has 1..N-1
- every `LATEX` block and every `EQUATION`'s `latexSource` actually parses
  under KaTeX — the database can't check this; `latex.block-template.sql`'s
  own comment says checking it is the importer's job

A file in the old flat/legacy shape (`stemEn`, `examType`, `questionType`,
`unitName`/`chapterName`/`topicName`) is detected specifically and
rejected with one clear message pointing at the needed conversion, instead
of a wall of generic "field missing" errors.

## What "tagged to a real topic" checks (against the live database)

- `conceptPath` resolves to a real, `is_taggable` `catalog.concept_node` row
- that concept is actually reachable from the question's `examCode` (i.e.
  `catalog.map_node_concept` has run for it — checked via
  `catalog.v_concept_coverage`)
- `baseFormat` is legal for this exam+subject per
  `catalog.exam_subject_format`
- `lumenId`, if supplied, isn't already in `content.question`

`NUMERICAL` and `MATCHING_LIST` are refused outright — their answer/option
storage shape was never demonstrated anywhere in the kit (OPEN ITEM 3, same
one `generate-questions.ts` already flags) — rather than guessed and
silently imported wrong.

## Verified against a real database

All of `fixtures/` has actually been run against a live `lumen_test`
database, not just read statically:

- `valid-mcq-single.json`, `valid-mcq-multiple.json` — the two worked
  examples from `gemini-question-gen/` — both `--dry-run` clean and real-
  import clean, landing the exact right number of `content_block` /
  `question_option` rows with the right correct-option counts.
- `valid-full-block-family.json` — two hand-built questions exercising
  every block family the AI-generation path never touches (EQUATION with
  variables, TABLE, IMAGE). Confirms `content.asset` checksum dedup for
  real: both questions reference the same figure and it lands as one
  `content.asset` row used by two `content_block` rows, not two uploads.
- `invalid-various.json` — four different rejection reasons in one file:
  a concept path that doesn't exist, unparsable LaTeX, two correct options
  on an `MCQ_SINGLE`, and a `NUMERICAL` question — each comes back with its
  own specific, correct reason.
- `legacy-flat-shape-stub.json` — the old shape, rejected with the
  conversion-pointer message instead of generic schema noise.
- Re-running an already-imported file for real is rejected as a duplicate
  `lumenId`, and the question count in the database is confirmed unchanged
  by the re-run.
- `content.v_question_eligibility` — confirmed at 0 before any import,
  still 0 immediately after importing both valid examples (correctly: they
  land `DRAFT` / `is_active = false`, matching how `generate-questions.ts`
  always writes AI output — awaiting review, not auto-published), then
  jumps to 6 rows the moment a reviewer flips both to `APPROVED` /
  `is_active = true` — one question tagged to one canonical concept,
  reachable from all three exams (NEET-UG, JEE-Main, JEE-Advanced)
  simultaneously. That fan-out is the entire point of the three-layer
  concept/syllabus/bridge architecture, and this is it actually happening
  against a real database, not asserted.

## Open items carried forward

Same four this whole kit has been carrying, still unconfirmed against the
real `010_question_model.sql`:

1. `content.question_concept` — the real question-to-concept tagging
   table's name/shape. The importer writes to the reconstruction's best
   guess.
2. `block_role = 'EXPLANATION'` — only `STEM` and `OPTION` are demonstrated
   anywhere in the kit.
3. `NUMERICAL` / `MATCHING_LIST` answer storage — refused rather than
   guessed (see above).
4. `content.question.author_id` — accepted if present (must be a UUID),
   but nothing validates it against an author table, because no such table
   has ever been confirmed to exist.

Replace `010_question_model.RECONSTRUCTED.sql` with the real
`010_question_model.sql` as soon as it's available, re-run the fixtures,
and revisit each open item above against what it actually says.
