# Build log — LA-BE-ENGINE-001

## TE-P0 — Audit and reconciliation
Date: 25-08-2026
Status: COMPLETE
Files created: docs/DB_STATE.md, docs/ENGINE_STATE.md, docs/OPEN_ITEMS.md
Files modified: none
Migrations applied: none (read-only phase)
Stop gate output: Table-and-row-count summary for all six schemas (assess/catalog/content/core/learn/public),
single Prisma-disposition recommendation ("confine Prisma to `public` only"), full contents of
docs/ENGINE_STATE.md — all presented to and approved by the project lead in-session.
Deviations from LA-BE-ENGINE-001:
- The brief's Section 1.6 estimate (migrations 000-006, 47 tables, concept-tree layer settled) does
  not describe this repository at all. Actual: migrations 000-018 (18 files before this phase, 19
  after TE-P1), 60 tables across the five custom schemas (not 47), no concept-tree layer
  (`content.question_node_map` maps a question straight to `catalog.syllabus_node` instead), no
  `content.next_lumen_id()`/`v_question_eligibility`/`util.*` helpers under any name. Full delta in
  docs/OPEN_ITEMS.md.
- A live, frontend-reachable Prisma attempt path (`/api/tests/*` via `backend/services/attempt.service.ts`
  against `public.*`) exists alongside the raw-SQL `assess.*` path, not the "known drift risk" the
  brief assumed. Both are toggled by `VITE_USE_REAL_API`; both are currently unable to serve real
  content because `content.question` and `public.questions` are both 0 rows.
- Defect (a) (`option_id` validation) is already closed on both live paths (DB trigger on the
  raw-SQL side, application code on the Prisma side) — narrower than the brief's framing. Defects
  (b) (non-transactional submitAttempt) and (c) (attempt_no race) are confirmed present as described.
Inputs still required: I-2 through I-15 (environment/access details beyond the repo path, and all
reference-data items — see docs/ENGINE_STATE.md §"Inputs needed"). I-8/I-9 cannot be satisfied by
handing over an existing ID: `core.institution` is 0 rows, none exists to point at.
Next phase: TE-P1

## TE-P1 — Schema completion
Date: 25-08-2026
Status: COMPLETE
Files created: db/migrations/018_test_engine.sql, db/verify/verify_018_test_engine.sql
Files modified: docs/DB_STATE.md (§9 TE-P1 delta appended)
Migrations applied: 018_test_engine.sql (verified live — structural check DO block plus a
functional constraint-rejection proof built on a fixture chain that force-rolled-back via its own
exception handler, same pattern as the pre-existing verify_011_assess_scope.sql)
Stop gate output:
```
NOTICE: verify_018_test_engine: OK — ledger table, four new assess tables, attempt columns, widened
  ck_attempt_state, and all five new indexes present
NOTICE: verify_018_test_engine: functional proof OK — times_seen, one-open-pause, pause-order,
  idempotency-operation, blueprint pick_count, blueprint question_format, widened attempt_state, and
  submitted_reason all reject their bad values and accept their good ones
NOTICE: verify_018_test_engine: proof complete, rolling back (no real rows touched)
verify_018_test_engine passed.
```
docs/DB_STATE.md §9 has the full diff summary.
Deviations from LA-BE-ENGINE-001:
- Work item 3 ("apply drafted-but-unapplied migrations 009/011/013") was a no-op — TE-P0 confirmed
  all three were already applied and verified live before this phase started.
- The brief's TE-P1 data contract was adapted to real column/table names rather than applied
  verbatim, per work item 2's own instruction to substitute an existing equivalent rather than
  duplicate one: `assess.test.source_type` ('generated'/else) stands in for a new `assembly_mode`
  column; `assess.attempt.server_deadline` stands in for `deadline_at`; `catalog.subject`
  (exam-scoped via `subject.exam_id`) stands in for a separate "exam_subject" entity;
  `ux_test_question_unique` was already present under the equivalent index on
  `(test_section_id, question_id)` and was not re-added. Full reasoning in the migration file's own
  header comment and docs/DB_STATE.md §9.
- New enum-like check-constraint values use this schema's existing lowercase snake_case convention
  (`student`/`expiry`/`admin`/`sweeper`, `attempt_start`/`attempt_submit`) rather than the brief's
  UPPER_CASE literals, per R-12 ("match the existing style").
- The learn-layer resource registry the brief's TE-P1 "Files" line mentions as an optional second
  pair was not built in this phase — it belongs to LL-P1 (Part B), out of this phase's order of work
  per brief §3.3, and was left for its own phase.
- I-8 to I-15 (reference data — institution/platform IDs, confirmed exam paper structures, test
  accounts, practice-test defaults) remain ungathered. None of TE-P1's actual schema-definition work
  needed them (the new tables' DDL was fully specified in the brief itself); they block TE-P3
  onward, where real content and a real institution are required to prove assembly against live data.
Inputs still required: I-8 through I-15 (unchanged from TE-P0's report).
Next phase: TE-P2 (scoring domain) — pure functions, no database dependency, so it does not block on
the still-missing reference data.

## TE-P2 — Scoring domain
Date: 25-08-2026
Status: COMPLETE
Files created: db/assess/scoring/{decimal,types,rules,evaluate,aggregate}.ts and their matching
  *.test.ts files (decimal.test.ts, evaluate.test.ts, rules.test.ts, aggregate.test.ts)
Files modified: none
Migrations applied: none (this phase has no database dependency by design)
Stop gate output: `node --import tsx --test --experimental-test-coverage "db/assess/scoring/*.test.ts"`
— 40/40 tests pass. Coverage: aggregate.ts 100/100/100 (line/branch/func), decimal.ts 100/90.48/92.31,
evaluate.ts 99.02/95.24/100, rules.ts 100/95.00/100; all-files 99.68/93.81/96.55. Isolated strict-mode
`tsc --noEmit` on the five source files: zero errors. Confirmed by grep: no import of a database
client, Express type, or `Date.now()` anywhere in the five source files (test files exempted, per
the brief's own "no function in this module" wording).
Deviations from LA-BE-ENGINE-001:
- Added a fifth file, `decimal.ts`, not named in the brief's Files list. R-11 ("marks are NUMERIC,
  no floating-point arithmetic anywhere in scoring") is a hard ground rule and the brief's own data
  contract types every mark value as a decimal `string`, never `number` — evaluating and aggregating
  those strings correctly requires exact decimal arithmetic, which JS's native `number` cannot
  provide (`0.1 + 0.2 !== 0.3` in IEEE754). Hand-rolled rather than adding a third-party
  big-decimal dependency, per R-12, since the operations needed are narrow (add/subtract/multiply/
  divide/compare on already-fixed-precision values).
- `ScoringRule` gained a field not in the brief's TS interface: `voidDisposition`. Work item 4
  requires a per-rule void disposition ("awards full marks... or is excluded... per the rule row")
  but the brief's own `ScoringRule` type has no field to carry it, and `catalog.marking_scheme`
  (docs/DB_STATE.md) has no matching column either. Documented in types.ts; whichever phase wires
  this engine to the live schema needs a follow-up migration adding the column.
- `JEE_ADV_2019` and `PROPORTIONAL` partial-credit formulas are this session's design choices, not
  values taken from the brief (which names the strategies but not their formulas). JEE_ADV_2019
  implements the publicly-documented official JEE Advanced multiple-correct scheme (full marks only
  for the complete correct set; +1 per correct option chosen when no incorrect option is chosen;
  negative marks otherwise) generalised as correctMarks/totalCorrectOptions per option rather than a
  hard-coded "+1", so it isn't tied to a specific total-marks value. PROPORTIONAL is a distinct,
  non-exam-specific generic scheme (credit and penalty both proportional to option count, floored at
  zero). Both documented in rules.ts's own comments. D-8 marks MCQ_MULTI partial credit as
  not required for the pilot gate, so this is implemented but not yet exam-verified against I-12/I-13.
- The brief's stop gate asks for "the coverage figure for the three source files" — this phase has
  four source files (plus decimal.ts, five), not three; the coverage figure covers all of them.
- Could not validate against I-12/I-13/I-14's real confirmed marking schemes — still ungathered (see
  TE-P0/TE-P1 entries). Every test uses representative rule values (4/-1/0, tolerance examples) that
  exercise the mechanism, not exam-certified real numbers. This should be revisited once I-12–I-14
  land, per R-5 (no fabricated real-world data).
Inputs still required: I-8 through I-15 (unchanged); I-12/I-13/I-14 specifically block validating
this phase's engine against real, confirmed exam marking schemes rather than representative values.
Next phase: TE-P3 (test definition and assembly) — blocked on I-16/I-17 (question content) and
I-8/I-9 (institution) to prove anything against real data; the assembly *code* itself is not
inherently blocked, but proving it against `content.question` while that table is 0 rows live
(docs/DB_STATE.md §5) would violate R-5. Recommend pausing for those inputs before starting TE-P3.

## TE-P3 — Test definition and assembly
Date: 25-08-2026
Status: COMPLETE
Files created: db/migrations/019_attempt_generation_seed.sql, db/verify/verify_019_attempt_generation_seed.sql,
  db/assess/test/definition/create-test.ts, db/assess/test/definition/ingest-paper.ts,
  db/assess/test/generation/assemble.ts, db/assess/test/generation/candidate-pool.sql,
  db/scripts/prove-te-p3-assembly.ts
Files modified: db/shared/errors.ts (added PoolInsufficientError, PaperInvalidError)
Migrations applied: 019_attempt_generation_seed.sql (verified live)
Stop gate output (`npx tsx db/scripts/prove-te-p3-assembly.ts`):
```
Part 1 (FIXED): createTest + ingestFixedPaper against the real 20-question fixture, 4 sections,
  20 test_question rows inserted, read-back order matches ingested order — PASS
Part 2 (BLUEPRINT): two assembleForAttempt calls for the same student, second seeded after marking
  round 1's picks seen (assess.user_question_seen) — disjoint from round 1 — PASS
Part 3 (POOL_INSUFFICIENT): a deliberately over-narrow scope (pick_count=999 against a 5-question
  physics pool) raised PoolInsufficientError naming the blueprint, section, requested=999, available=3
  (3, not 5, because rounds 1-2 had already marked 2 of the 5 physics questions seen) — PASS
Part 4 (EXPLAIN ANALYZE): 0.345ms execution time for the full candidate-pool query — PASS
```
Isolated strict-mode `tsc --noEmit` on all five new/changed source files: zero errors.
Deviations from LA-BE-ENGINE-001:
- Reused this repository's own pre-existing, already-committed seed scripts
  (`db/scripts/seed/{00_core_roles,01_catalog,02_content,02_core_lifecycle_fixture,03_assess_fixture}.ts`)
  to restore the institution, five role-fixture accounts, and 20 real (not fabricated) legacy
  questions that `db/MIGRATION_STATE.md` recorded as created in an earlier session but which
  docs/DB_STATE.md found were no longer live. Chosen over writing new placeholder-data scripts per
  the user's explicit instruction to build now against placeholder/seed data and swap in real
  confirmed inputs later — and because these scripts already existed, were idempotent, and used real
  legacy content rather than inventing new fabricated stems. This satisfies I-8/I-9/I-10/I-11 with
  restored real fixture data and I-16/I-17 with real (if thin — 20 questions, not the brief's
  "minimum 30 per chapter") legacy content; I-12/I-13/I-14 (confirmed real NEET/JEE paper structures)
  remain unmet — the scratch pattern is still 20q/80marks/60min, not the real ~200q/720marks/180min.
- Added `db/migrations/019_attempt_generation_seed.sql`: the brief's TE-P4 "Done when" requires a
  per-attempt random seed persisted for reproducible assembly, but `assess.attempt` had no such
  column (only `assess.test.generation_seed`, which is per-test, not per-attempt). A genuine gap,
  not a rename — confirmed against docs/DB_STATE.md before adding it.
- `ingestFixedPaper`'s validation substitutes a `content.question_node_map`-based subject-tag check
  for the brief's `question_exam_usage` check (that table doesn't exist — docs/OPEN_ITEMS.md), and
  drops the brief's "matches the section's permitted format" check entirely: `catalog.pattern_section`
  has no format-restriction column to check against in this schema (only BLUEPRINT-mode's
  `test_blueprint.question_format` does, which doesn't apply to FIXED-mode ingestion). Documented in
  ingest-paper.ts's own header comment.
- `candidate-pool.sql` is a documentation-only reference copy; the query that actually executes is
  inline in `assemble.ts` (`CANDIDATE_POOL_SQL`), matching this codebase's existing convention of
  keeping hot-path SQL next to the code that runs it (`attempt-flow.ts`) rather than reading `.sql`
  files at runtime. Flagged so the two are kept in sync by hand, not assumed automatically consistent.
- TE-P3's own "persist the served set" language belongs to TE-P4's `startAttempt` (brief work item 1
  there), not to `assembleForAttempt` here — confirmed by re-reading both phases' work-item lists.
  `assembleForAttempt` is read-only (R-1: "assembly is a database query"), returns the picks and a
  freshly generated seed, and does not write anything. This also surfaced a real gap for TE-P4:
  this schema has **no attempt-scoped served-question table** (unlike the Prisma track's
  `public.attempt_questions`) — `assess.test_question` is scoped to the whole test, not one attempt,
  so it cannot hold a per-attempt BLUEPRINT pick. TE-P4 will need a new table for this, not yet built.
- The proof script's rows (`TE_P3_PROOF_FIXED`, `TE_P3_PROOF_BLUEPRINT_1/2/3` test rows, one
  `catalog.exam_pattern` at `version_no=999`, `is_current=false`) are left live rather than rolled
  back, matching `db/scripts/seed/03_assess_fixture.ts`'s existing precedent for genuine (not
  fabricated) proof fixtures. `assess.user_question_seen` now has 2 real rows for the student fixture
  from this run.
Inputs still required: I-12/I-13/I-14 (real confirmed paper structures — still using the 20q/80marks
scratch pattern) and I-16 through I-19 at real volume (20 questions total is enough to prove the
mechanism, not enough for a credible demonstration per the brief's own "minimum 30 per chapter").
Next phase: TE-P4 (attempt runtime) — the pilot-demonstration-critical phase. Needs a new migration
for the attempt-scoped served-question table this phase's work just surfaced as missing, before
`startAttempt` can persist a BLUEPRINT pick per attempt.

## TE-P4 — Attempt runtime
Date: 25-08-2026
Status: COMPLETE (core work items 1-6, 9 proven live; items 7 and 8 implemented but not separately
  proof-run this session — see deviations)
Files created: db/migrations/{020_attempt_question,021_attempt_response_question_unique}.sql +
  matching verify scripts, db/assess/test/attempt/envelope.ts, db/assess/test/attempt/expiry.ts,
  db/scripts/sweep-expired-attempts.ts, db/scripts/prove-te-p4-attempt.ts
Files modified: db/assess/test/attempt/attempt-flow.ts (rewritten per the brief's own Files list),
  db/shared/errors.ts (7 new typed errors), backend/middleware/errorHandler.ts (wired all of TE-P3's
  and TE-P4's new errors, plus LM001/23505 SQLSTATE mappings closing the defect-(a)/(c) 500-instead-
  of-4xx gap docs/ENGINE_STATE.md §3 found), backend/controllers/attemptFlowController.ts and
  backend/routes/assess.routes.ts (minimal call-site fixes so the live route keeps compiling and
  working against the new signatures — not a full DTO rewrite, that stays TE-P6's job)
Migrations applied: 020_attempt_question.sql, 021_attempt_response_question_unique.sql (both verified live)
Stop gate output (`npx tsx db/scripts/prove-te-p4-attempt.ts`, against the real 20-question
NEET_E2E_FIXTURE test and the student@lumen.internal fixture account):
```
Part 1 (startAttempt, idempotent): two calls with the same idempotencyKey return the same
  attempt_id — PASS
Part 2 (getAttemptEnvelope, R-9): 20 questions / 4 sections served; no isCorrect/correctOptionIds/
  correctNumericValue/solutionText/explanation/answerTolerance key anywhere in the serialized
  envelope — PASS (first run flagged a false positive on the bare substring "solution", which turned
  out to be the word "solutions" inside a real chemistry question's own stem text, not a leak —
  fixed the check to match JSON keys specifically, see deviations)
Part 3: answered 14/20 questions (mixed correct/incorrect/unattempted), hand-computed expected
  total = 21 marks against the seeded NEET_STANDARD scheme (4/-1/0)
Part 4 (pause/resume): status transitions in_progress -> paused -> in_progress correctly — PASS
Part 5 (submit): obtained 21/80 marks, matching the hand-computed total exactly — PASS. Resubmitting
  with the same idempotencyKey returns the identical stored result — PASS. Resubmitting with NO key
  at all (simulating a naive retry) also returns the identical result via attempt_state='scored'
  short-circuiting, not just key replay — PASS (D-7 satisfied both ways, not only the key-based path)
Part 6 (D-2 seen ledger): all 20 served questions have a assess.user_question_seen row after
  submission — PASS
```
Isolated + whole-project `tsc --noEmit`: zero new errors (the two pre-existing errors in
backend/services/attempt.service.ts and backend/services/aiExplanation.service.ts, both Prisma
Decimal-type mismatches in files this phase never touches, are unchanged from before this session).
Deviations from LA-BE-ENGINE-001:
- **Added `db/migrations/020_attempt_question.sql`**: TE-P3's own build log already flagged this gap
  — this schema had no attempt-scoped served-question table, so BLUEPRINT mode (D-1) had nowhere to
  persist a per-attempt pick distinct from the test-wide `assess.test_question`. `assess.attempt_question`
  fills it, used uniformly by both modes so attempt-runtime code never branches on assembly_mode.
  Also: rewrote `assess.trg_attempt_response_option_guard` (CREATE OR REPLACE, not an edit to an
  applied migration — R-4) to validate through `attempt_question` when no `test_question_id` exists,
  and gave it a custom SQLSTATE (`LM001`) so `errorHandler.ts` can map a mismatched option to the
  brief's catalogued `RESPONSE_OPTION_MISMATCH` — closing the exact "trigger fires correctly but
  degrades to a generic 500" gap `docs/ENGINE_STATE.md` §3(a) found. `assess.attempt_response` gained
  a `question_id` column (now the practical key) and `test_question_id` became nullable.
- **Added `db/migrations/021_attempt_response_question_unique.sql`**: a unique index on
  `(attempt_id, question_id)` that 020 needed but omitted — `upsertResponse`'s `ON CONFLICT` target
  had nothing to bind to otherwise. Caught while writing `attempt-flow.ts`, fixed as its own migration
  rather than editing 020 (R-4).
- **`db/migrations/019_attempt_generation_seed.sql`** (applied during TE-P3, listed again here since
  TE-P4 is what actually consumes it): `assess.attempt.generation_seed`, filled by `startAttempt` for
  BLUEPRINT-mode attempts from `assembleForAttempt`'s returned seed.
- **Scope narrowed to work items 1-6 and 9** (`startAttempt`, `getAttemptEnvelope`, `upsertResponse`,
  `batchUpsertResponses`, `pauseAttempt`/`resumeAttempt`, `submitAttempt`, and the attempt_event
  append-only trail) plus the D-6 lazy-expiry function and the D-6 sweeper script (work items 7-8),
  all implemented — but only items 1-6 and 9 were exercised by this session's proof script. Expiry
  enforcement (`expiry.ts`'s `enforceExpiry`) and the sweeper
  (`db/scripts/sweep-expired-attempts.ts`) are written and typecheck cleanly but have **not** been
  run against a genuinely expired live attempt this session — there wasn't a fast, honest way to
  produce one without either fabricating a backdated `server_deadline` (borderline R-5 territory) or
  waiting out a real test duration. Flagged plainly rather than claimed proven (R-13); worth a
  dedicated short proof run before relying on this in the pilot demonstration.
- **Numeric-answer grading is now implemented** (the pre-existing `attempt-flow.ts` had explicitly
  left it ungraded — "the design pack doesn't say which governs" — see the old file's header comment,
  now removed): `content.question.answer_tolerance` (per-question, absolute) and
  `catalog.marking_scheme.numeric_tolerance_pct` (per-scheme, relative) both feed TE-P2's
  `evaluateResponse`, which accepts either simultaneously and treats whichever is more permissive as
  satisfying the match — a documented judgment call (`evaluate.ts`'s own comment), since the brief's
  data contract allows both to be non-null without stating a combination rule.
- **`isVoided` is hard-coded `false` and `voidDisposition` hard-coded `'EXCLUDED'`** for every served
  question — this schema has no live `is_voided`/equivalent column on `content.question` (confirmed
  absent, not renamed). TE-P2's VOID path is fully implemented and unit-tested but unreachable from
  live data until a future migration adds that column. Documented in `types.ts`'s own comment
  (written during TE-P2) and unchanged here.
- **`attemptFlowController.ts` / `assess.routes.ts` were touched minimally**, not fully rewritten:
  the response-save route's path param was renamed `:testQuestionId` -> `:questionId` (matching both
  the brief's own TE-P6 endpoint catalogue and `upsertResponse`'s new questionId-first signature),
  and call sites were updated to the new function signatures/return shapes. No DTO validation layer,
  no role/ownership redesign, no route additions for `getAttemptEnvelope`/`pauseAttempt`/
  `resumeAttempt` (none of the three has a route yet) — all of that is explicitly TE-P6's phase, not
  pulled forward here. This was necessary rather than optional: leaving the controller calling the
  old signatures would have left a currently-mounted, previously-working route broken.
- `getPaperForAttempt` (pre-existing, FIXED-mode-only, still reads `assess.test_question` directly)
  was left unchanged rather than deleted — `envelope.ts`'s `getAttemptEnvelope` is its mode-agnostic,
  R-9-correct replacement, but retiring the old route it backs is TE-P6's "strip the old write/read
  paths" mandate, not this phase's.
- Section-average `time_spent_seconds` in `section_score` depends on the client actually supplying
  `timeSpentSeconds` on each response (nothing populates it automatically) — untested in this proof
  run since the script didn't pass that field; the column and query are correct, just unexercised
  with real timing data.
Inputs still required: unchanged (I-12/I-13/I-14 real paper structures; I-16 to I-19 at real volume).
Next phase: TE-P5 (scorecard and review) can start — `assess.scorecard`/`section_score` are now
populated by a real, live-proven `submitAttempt`. Before TE-P6 (HTTP surface), worth a short session
specifically proving `enforceExpiry` and the sweeper against a real expired attempt, since this one
didn't.

## CL-2 — General-purpose content importer, CL-3 — Asset storage resolver
Date: 26-08-2026
Status: COMPLETE (both G3 and G4 gates cleared with the real tooling, not the manual reproduction
`docs/CL2_DryRun_Report_Batch1.md` / `docs/CL2_DryRun_Report_Batch2-3-4.md` used because CL-2 didn't
exist yet at the time those were written)
Files created: db/scripts/import/import-content.ts (CL-2), db/content/asset-resolver.ts (CL-3),
  db/scripts/prove-cl3-asset-resolver.ts
Files modified: .env (added `OBJECT_STORAGE_BUCKET="content-assets"`)
Migrations applied: none
External changes: created the `content-assets` Supabase Storage bucket (public, 10MB file-size limit)
  — none existed in the project before this phase (`storage.listBuckets()` returned 0). Public rather
  than private/signed-URL because question diagram images need to be directly fetchable by any
  authenticated student without a signing round-trip, and nothing in `content.asset` is
  access-sensitive on its own (RLS/ownership is enforced at the question/attempt layer, not the
  image). Revisit if that assumption turns out wrong.
Stop gate output:
```
CL-2 dry-run, all 4 authored batches (content-batches/batch-{1..4}-*.json), real importer not a
reproduction:
  batch-1 (phy_02):  30/30 valid, 0 schema_error, 0 unmapped_node, 0 missing_asset
  batch-2 (chem_08): 30/30 valid, 0 schema_error, 0 unmapped_node, 0 missing_asset  <- incl. the 5 real images
  batch-3 (bot_07):  30/30 valid, 0 schema_error, 0 unmapped_node, 0 missing_asset
  batch-4 (zoo_03):  30/30 valid, 0 schema_error, 0 unmapped_node, 0 missing_asset
  Per-row JSON reports written to db/reports/import_<batch>_<timestamp>.json.

CL-3 proof (db/scripts/prove-cl3-asset-resolver.ts), against a real live content.question row
(LEGACY-13, one of TE-P3's restored fixture questions) and a real batch-2 diagram file:
  content.asset row landed (asset_id 73354e10-c394-43bc-a9bd-7cb2fa49fd09)
  resolveAssetUrl() -> https://<project>.supabase.co/storage/v1/object/public/content-assets/
    question/<question_id>/CHE_SOMBAS_DIAG_0001.png
  GET on that URL -> 200 image/png
  CL-3 PASS
```
Isolated `tsc --noEmit` on all three new files: zero errors (the project-wide run still shows the
same 2 pre-existing Prisma Decimal-type errors in `backend/services/{attempt,aiExplanation}.service.ts`
noted in TE-P4 — unchanged, untouched by this phase).
Deviations from LA-PLAN-002:
- **CL-2 defaults to dry-run; `--live` is required to write anything.** The plan's Day 1 scope is
  dry-run only (live import is explicitly a Day 2 item, gated by G3) — building the importer
  dry-run-by-default rather than requiring a `--dry-run` opt-in makes the safe mode the one that
  needs no flag, so a bare invocation can never accidentally write to the shared database.
  **Only the dry-run path was actually executed this session** — live import against real data was
  not run, per the plan's own Day 2 placement; `--live` exists and typechecks but is unproven this
  session.
- **CL-2 does not write `content.question_node_map` directly.** `content.trg_question_primary_node_sync`
  (010_content_rich.sql) already inserts that row automatically on `content.question` insert/update of
  `primary_node_id`, `on conflict (question_id, node_id) do nothing`. Writing it again from CL-2 would
  be redundant, not incorrect, but redundant per R-12.
- **CL-2 batch-scopes to one exam and one syllabus_version.** `content.import_batch` has exactly one
  `exam_id`/`syllabus_version_id` column each (013_content_import.sql), so a batch file whose valid
  rows resolve to more than one of either is refused outright before any write, rather than picking
  one arbitrarily or splitting silently into multiple batches.
- **CL-3's idempotency key is `content.asset.storage_uri`, checked in application code, not
  `ON CONFLICT`.** `content.asset` has no unique constraint on `storage_uri` in any applied migration
  — adding one just for this would be a new migration for a single caller's convenience. A
  select-then-insert-or-update in `uploadAsset()` gets the same idempotent-reupload behaviour without
  a schema change.
- **Created the `content-assets` bucket and added `OBJECT_STORAGE_BUCKET` to `.env`** — both were
  genuinely absent (confirmed via `storage.listBuckets()` returning empty, and `dbConfig.objectStorageBucket`
  parsing as `undefined`), not an existing setup CL-3 could just point at. Flagged plainly since bucket
  naming/visibility is a real decision, not a mechanical default: `content-assets`, public, 10MB limit.
- **CL-3's system import user is `content-import@lumen.internal`, distinct from `02_content.ts`'s
  `legacy-import@lumen.internal`.** Same pattern (Supabase Auth Admin API + `core.app_user` upsert,
  `user_role='system'`), kept as a separate account so the one-time legacy migration and the ongoing
  CL-2 pipeline don't share an identity in `content.ai_generation_job.requested_by` / `content.import_batch.submitted_by`.
- **Imported questions land at `lifecycle_status='draft'`, not `'published'`** (unlike `02_content.ts`,
  which was a one-shot legacy migration that published directly). CL-4 (content lifecycle service,
  not yet built) is the intended gate from `draft` onward; skipping straight to `published` here would
  let unreviewed authored content reach students before CL-4 exists to review it. On re-import,
  `lifecycle_status` is deliberately left out of the `ON CONFLICT ... DO UPDATE SET` list so a
  re-run never silently reverts an already-approved/published question back to draft.
Inputs still required: unchanged. Real live import (Day 2) and the asset upload run over all of
batch-1/batch-2's images (currently only 1 of 5 batch-2 images has been uploaded, as CL-3's proof)
remain Day 2 work per the roadmap.
Next phase: Day 2 — live import of all 4 batches via `--live`, followed by the full asset upload run
for batch-2's remaining 4 images, per LA-PLAN-002 §4.1.
