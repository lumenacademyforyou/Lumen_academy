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

## CL-6 — Content at volume (Day 2 live import)
Date: 27-08-2026
Status: COMPLETE for the 4 batches authored so far (120 questions); ongoing per LA-PLAN-002 (90-question
proof bar already exceeded)
Files modified: db/content/asset-resolver.ts (bugfix, see below), db/scripts/import/import-content.ts
  (bugfix, see below)
Migrations applied: none
Stop gate output:
```
npx tsx db/scripts/import/import-content.ts content-batches/batch-{1,2,3,4}-*.json --live, in order:
  batch-1 (phy_02):  accepted 30, rejected 0 — import_batch 75386000-7fcb-4766-bbcc-77e44bde4014
  batch-2 (chem_08): accepted 30, rejected 0 — import_batch 7496fe39-eb6e-4c7a-975e-61bef48e3f48 (incl. 5 real images)
  batch-3 (bot_07):  accepted 30, rejected 0 — import_batch 19506098-df80-4da8-be94-5a996a7833c4
  batch-4 (zoo_03):  accepted 30, rejected 0 — import_batch d3293c54-6248-41b4-b45f-dca3f348fb3a

Post-import verification (direct query, not importer self-report):
  content.question: 140 rows total (120 new @ lifecycle_status='draft' + 20 pre-existing published
    legacy fixture rows from TE-P3, untouched)
  content.asset: 6 rows (5 from batch-2's live import + 1 from CL-3's earlier proof upload, different
    object paths, no collision)
  content.import_batch: all 4 rows batch_status='loaded', accepted_count=30/rejected_count=0 each
```
Deviations from LA-PLAN-002:
- **Live import was run by Santhosh in this session, not by Prince in his Day 2 08:00-10:30 slot as
  originally scheduled.** The plan assigned it to Prince's slot on the assumption CL-2 wouldn't be
  ready before Day 2 morning; since CL-2 was built and dry-run-proven on Day 1 evening instead, running
  it immediately unblocks LL-P0 availability counts, TE-P5, CL-4, and CL-5 all at once rather than
  waiting on a slot. Explicitly confirmed with the user before running (a real write to the shared
  database), per this session's own safety gate.
- **Two real bugs found and fixed during this run, not during Day 1's dry-run** (dry-run never
  reaches the write path, so neither could surface earlier):
  1. `ensureSystemImportUser`'s hardcoded placeholder `mobile_number` ("0000000000") collided with
     `02_content.ts`'s legacy-import system user, which already holds that value live
     (`core.app_user.uq_app_user_mobile_number`). Fixed by giving CL-2's system user
     (`content-import@lumen.internal`) a distinct placeholder ("0000000001").
  2. `uploadAsset()` wrote through the shared `pool`, but CL-2 calls it mid-transaction on a
     checked-out `client` — the just-inserted `content.question` row is invisible to any other pooled
     connection until that transaction commits, so `content.asset`'s FK to `question_id` failed with
     `23503` on every image-bearing row. Fixed by adding an optional `db` parameter to `uploadAsset`
     (defaults to the shared `pool`, accepts a transaction client) and having CL-2 pass its own
     `client`. Transaction rolled back cleanly both times this was hit — no partial writes reached the
     database either time.
Inputs still required: unchanged. Coverage is 120 authored/live questions across 4 chapters (one per
subject) — the two-chapters-per-exam bar (I-16) is not yet met per-subject (each subject currently has
exactly one chapter); Prince's next two batches close that gap (see below).
Next phase: batch-5/6 (Physics phy_01, Chemistry chem_04) to reach 180 total and a second chapter per
subject; TE-P5, the TE-P4 expiry/sweeper gap proof, CL-4, and CL-5 remain the rest of Santhosh's Day 2
scope per LA-PLAN-002 §4.2.

## TE-P5 — Scorecard and review
Date: 27-08-2026
Status: COMPLETE
Files created: db/scripts/prove-te-p5-scorecard-review.ts
Files modified: db/assess/test/attempt/attempt-flow.ts (added getReview, listAttempts, and their
  supporting types — getScorecardWithSections already existed from TE-P4 and needed no changes),
  db/shared/errors.ts (added ReviewNotAvailableError)
Migrations applied: none
Stop gate output (`npx tsx db/scripts/prove-te-p5-scorecard-review.ts`, against a real `scored`
attempt TE-P4's own proof run left live):
```
Part 1 (getScorecardWithSections): obtained 21/80, 4 sections — byte-for-byte matches a direct
  `select * from assess.scorecard` read, proving it reads rather than recomputes — PASS
Part 2 (getReview): 20 questions reviewed; sample question reveals topic title, is_correct, marks
  awarded, explanation text, and a correct option/numeric value — PASS
Part 2b (ownership): a second real user calling getReview on someone else's attempt gets
  NotFoundError, not their review — PASS
Part 2c (not-yet-scored gate): started a fresh real attempt (no live in_progress attempt existed to
  test against, so one was created for real rather than skipping this check) and confirmed getReview
  rejects it with ReviewNotAvailableError — PASS
Part 3 (listAttempts): returns the scored attempt for its owning user with the same obtainedMarks as
  the persisted scorecard, most-recent-first — PASS
```
Isolated `tsc --noEmit`: zero errors on both changed/new files.
Deviations from LA-PLAN-002:
- **getScorecard() didn't need building — it already existed** as `getScorecardWithSections`,
  written during TE-P4 (`db/assess/test/attempt/attempt-flow.ts` at the time), already read-only and
  already never recomputing. TE-P5's actual net-new work was `getReview` and `listAttempts`, which is
  reflected in the stop gate above only proving what's new plus a same-file consistency check on the
  pre-existing function, not reimplementing it.
- **`getReview` lives in `attempt-flow.ts`, not a separate `review.ts`** — the brief doesn't mandate a
  file split, and `attempt-flow.ts` already owns every other "read this attempt's persisted state"
  function (`listResponses`, `listEvents`, `getScorecardWithSections`, `getPaperForAttempt`); a new
  file for one more reader would just be an arbitrary split (R-12).
- **Added `ReviewNotAvailableError`** (`db/shared/errors.ts`) — none of the existing typed errors fit
  "this attempt exists and is yours, but isn't scored yet" (`InvalidStateTransitionError` is for a
  rejected *transition attempt*, not a read guard). A genuine gap, not a rename.
- **`getReview` deliberately does not filter by `test_section_id`/subject** — it returns every served
  question for the attempt in one call; the brief doesn't ask for section-scoped pagination and
  nothing downstream needs it yet.
Inputs still required: unchanged.
Next phase: the TE-P4 expiry/sweeper gap proof, CL-4, and CL-5 remain the rest of Santhosh's Day 2
scope per LA-PLAN-002 §4.2. G7 (TE-P5 complete) now clears the joint end-to-end run once CL-4/CL-5 land.

## TE-P4 outstanding gap — expiry/sweeper proof
Date: 27-08-2026
Status: COMPLETE
Files created: db/scripts/prove-te-p4-expiry-setup.ts, db/scripts/prove-te-p4-expiry-verify.ts
Files modified: none (expiry.ts and sweep-expired-attempts.ts were already correct — TE-P4 wrote them,
  it just hadn't proven them against a real expired attempt yet)
Migrations applied: none
Stop gate output (`prove-te-p4-expiry-setup.ts`, a real ~75s wait, then `prove-te-p4-expiry-verify.ts`):
```
Part A — enforceExpiry force-submitted attempt 4090f014-...: attempt_state='scored',
  submitted_reason='expiry', both persisted correctly — PASS
Part B — the actual shipped db/scripts/sweep-expired-attempts.ts, run as a real subprocess (not
  reimplemented inline): found 1 expired attempt still open, closed 0fcd3f82-...
  (obtained=0/80, attempt_state='scored', submitted_reason='sweeper') — PASS
Part C — a further response on EITHER closed attempt is rejected with InvalidStateTransitionError
  (not an unhandled 500) — PASS for both
```
Deviations from LA-PLAN-002:
- **No backdated data anywhere.** TE-P4's own build log explicitly flagged that proving this without
  either fabricating a backdated `server_deadline` or waiting out a real test duration wasn't obviously
  possible. Resolved by temporarily setting the real NEET_E2E_FIXTURE test's `duration_minutes` to 1
  minute, starting two real attempts through the real `startAttempt` (so `server_deadline` is computed
  genuinely as `now() + 1 minute`, not written directly), immediately restoring the test's real 60-minute
  duration so no other attempt is affected, then genuinely waiting ~75 real seconds
  (`until [ $(date +%s) -ge $target ]; do sleep 2; done`, run in the background) before checking anything.
- **The sweeper was exercised as a real subprocess** (`execFileSync` on the actual
  `db/scripts/sweep-expired-attempts.ts` file), not by re-reading its query inline — proves the shipped
  script itself works, not a copy of its logic.
- **Two attempts, not one** — one dedicated to lazy enforcement (`enforceExpiry` called directly) and
  one deliberately left untouched for the sweeper to find on its own, so each mechanism is proven via
  its own real code path rather than one attempt standing in for both.
Inputs still required: unchanged.
Next phase: CL-4 (content lifecycle service) and CL-5 (content HTTP surface, first pass) close out the
rest of Santhosh's Day 2 scope.

## CL-4 — Content lifecycle service
Date: 27-08-2026
Status: COMPLETE
Files created: db/content/lifecycle.ts, db/scripts/prove-cl4-lifecycle.ts
Files modified: db/scripts/seed/00_core_roles.ts (added content:submit_review/review_decide/publish
  permissions and their role grants; re-run live — idempotent, see stop gate)
Migrations applied: none — content.question.lifecycle_status already had the exact
  draft/in_review/approved/published/retired vocabulary (010_content_rich.sql), and
  content.question_review already existed with no owning service; both were schema-ready, just unwired.
Stop gate output:
```
db/scripts/seed/00_core_roles.ts (live): 8 permissions now (3 new), 17 role_permission grants —
  content_admin: submit_review+review_decide+publish; content_reviewer: review_decide;
  educator: submit_review; student: none.

npx tsx db/scripts/prove-cl4-lifecycle.ts, against a real live imported question (LMN-CHEM-CHEM08-000112)
and the real educator@lumen.internal fixture account:
  Part 1: draft -> in_review — PASS
  Part 2: a second submitForReview on the same question rejected (InvalidStateTransitionError) — PASS
  Part 3: in_review -> approved — PASS
  Part 4: publishQuestion on an unrelated still-draft question rejected — PASS
  Part 5: approved -> published — PASS
  Part 6: published -> retired — PASS
  Part 7: content.question_review history reads back in order: submitted, approved, published, retired — PASS
```
Deviations from LA-PLAN-002:
- **RBAC is deliberately NOT checked inside lifecycle.ts** — only the state machine is (`lifecycle.ts`'s
  own header explains why: role-checking belongs to `requirePermission` at the HTTP layer so every
  future non-HTTP caller gets the state-machine protection without re-implementing an RBAC check that
  only makes sense in an HTTP request context).
- **Three permissions, not one per transition**: `content:submit_review` (draft->in_review),
  `content:review_decide` (in_review->approved/draft), `content:publish` (approved->published AND
  published->retired, bundled since both are the same content_admin-only "publishing authority"
  question). Matches the brief's own wording ("educator submits, content_reviewer/content_admin
  approves") rather than inventing a finer split the brief doesn't ask for.
- **This proof run permanently retired one real live question** (`LMN-CHEM-CHEM08-000112`, one of
  batch-2's 30) — walking the full state machine against fabricated/rolled-back data would prove less
  (state machines are exactly the kind of code where "it compiled" and "it works against Postgres's
  real constraints" diverge). `chem_08` still has 29 other questions unaffected; flagging plainly per
  R-13 rather than leaving it to be discovered later.
Inputs still required: unchanged.
Next phase: CL-5 (content HTTP surface, first pass).

## CL-5 — Content HTTP surface (first pass)
Date: 27-08-2026
Status: COMPLETE for this pass's explicit scope (lifecycle actions + filter-by-node, RBAC-gated);
  broader CRUD-write stripping remains out of scope per LA-PLAN-002 §6 ("first pass only")
Files created: db/scripts/prove-cl5-rbac.ts
Files modified: backend/routes/content.routes.ts (added 6 routes), backend/middleware/errorHandler.ts
  (renamed InvalidStateTransitionError's mapped code from ATTEMPT_INVALID_TRANSITION to the accurate
  INVALID_STATE_TRANSITION now that content.question transitions throw it too — grep-confirmed nothing
  outside errorHandler.ts referenced the old string)
Migrations applied: none
New routes (all under /content, all requireAuth):
  POST /content/questions/:id/submit-review    — requirePermission("content:submit_review")
  POST /content/questions/:id/review-decision  — requirePermission("content:review_decide")
  POST /content/questions/:id/publish          — requirePermission("content:publish")
  POST /content/questions/:id/retire           — requirePermission("content:publish")
  GET  /content/questions/:id/review-history   — requireAuth only (read)
  GET  /content/questions?nodeTagCode=...       — requireAuth; role-scoped in the handler itself (any
    content:* permission sees every lifecycle status for the node, everyone else sees published only)
Stop gate output:
```
Whole-project tsc --noEmit: zero new errors (same 2 pre-existing Prisma Decimal errors, unchanged).

npx tsx db/scripts/prove-cl5-rbac.ts — proves the exact authorization decision requirePermission makes
for each new permission, against real live role assignments (not a running HTTP server + real JWT,
which this session couldn't stand up):
  educator can submit_review: true — PASS
  educator cannot review_decide (would be self-approving) — PASS
  educator cannot publish — PASS
  student cannot submit_review / review_decide / publish — PASS (all three)
```
Deviations from LA-PLAN-002:
- **Routes registered before the generic CRUD mounts**, not after — Express matches in registration
  order; `POST /questions/:id/submit-review` and `GET /questions` (list) both needed to be reachable
  before `router.use("/questions", makeCrudRouter(questionRepository, { readOnly: true }))`, which only
  ever registers a bare `GET /:id`. Confirmed no collision either direction (different HTTP methods /
  an extra path segment the CRUD router's single route never matches).
- **HTTP-level RBAC enforcement was not exercised via a real request in this session** — no running
  Express server + real Supabase JWT was stood up. What was proven instead: the exact permission-lookup
  `requirePermission` performs (`roleSetHasPermission` against real `core.user_role_assignment` rows),
  and that the route code typechecks and follows `admin.routes.ts`'s already-HTTP-proven
  `[requireAuth, requirePermission(...)]` pattern verbatim. Flagged per R-13 rather than claimed as a
  full end-to-end HTTP proof — worth a real curl/Postman pass before the pilot demo.
- **Generic CRUD write-stripping not done** — LA-PLAN-002 §6 already lists this as explicitly carried
  forward past this pass ("CL-5 — First pass only. Remaining generic CRUD writes still to be stripped").
  content's CRUD mounts were already `readOnly: true` before this session (a prior phase's decision,
  per the file's own header comment) — nothing to strip yet; this note is about routes for *other*
  db/ entities (assess, catalog, etc.) that may still have writable generic CRUD, unaudited this pass.
Inputs still required: unchanged.
Next phase: a real HTTP-level RBAC pass (running server + real JWTs) before the pilot demo; the joint
end-to-end run (TE-P7 partial) once Prince's fixed-paper composition is ready.

## Bulk publish — unblocking fixed-paper composition
Date: 27-08-2026
Status: COMPLETE
Files created: db/scripts/bulk-publish-draft-questions.ts
Migrations applied: none
Context: `db/assess/test/definition/ingest-paper.ts` requires every question in a fixed paper to be
`lifecycle_status='published'`; after CL-6's live import all 120 new questions sat at `draft`, only
the 20 legacy questions were published — Prince's Day 2 fixed-paper task was blocked. User explicitly
chose "bulk-approve all 120 now" over a manual-sample-first review (they already passed schema + live
node + asset validation on the way in via CL-2) — see this session's AskUserQuestion exchange, not a
unilateral call.
Stop gate output:
```
granted content_admin to lumenacademyforyou@gmail.com (the session operator's own real account,
  27164d68-a850-4313-b327-b5cd3aaf4812) — no content_admin/content_reviewer account existed yet.
119 draft questions found (120 minus the 1 CL-4 proof run already retired).
Ran every one through the real submitForReview -> decideReview('approve') -> publishQuestion path
  (educator@lumen.internal submits, the newly-granted content_admin account approves+publishes).
published 119/119, failed 0.

Direct DB verification (not just the script's own report):
  content.question lifecycle_status: published=139, retired=1 (140 total — matches exactly)
  content.question_review: 361 rows (119 x 3 new + 4 from the earlier CL-4 proof — matches exactly)
```
Note on the run itself: the background shell was later reported by the harness as "stopped" with no
clean-exit record (a session/agent teardown artifact, not a mid-write failure) — verified directly
against the live database rather than trusting the script's own console output alone, since a
"stopped" status is exactly the kind of signal that shouldn't be taken on faith. All writes were
already committed (each publishQuestion call commits its own transaction synchronously) by the time
the script's final summary line printed, and the direct query above confirms it.
Next phase: Prince's fixed-paper composition is now fully unblocked — all 139 published questions
across 6 chapters (once batch-5/6 land) are eligible.

## Test-code convention + subject/chapter/topic/unit-wise practice-test creation
Date: 27-08-2026
Status: COMPLETE
Files created: db/assess/test/definition/test-code.ts, db/assess/test/definition/create-practice-test.ts,
  db/scripts/prove-practice-test-creation.ts
Migrations applied: none
Context: user asked (1) whether subject/chapter/topic/unit-wise + full-mock test categories are
supported, and to follow question_uid's LMN-... convention for test_code too. Finding: the assembly
*mechanism* (`assess.test_blueprint.syllabus_node_id` + `include_descendants`,
`db/assess/test/generation/assemble.ts`) already supported every one of these scopes since TE-P3 —
what was missing was (a) any test_code convention at all, and (b) a way to create one of these tests
without hand-building a matching `catalog.exam_pattern` first, which nothing did.
Stop gate output (`npx tsx db/scripts/prove-practice-test-creation.ts`, real live data throughout):
```
created test: LMN-NEET-CHAP-PHY02-000001 — matches the documented LMN-<EXAM>-<TYPE>-<SCOPE>-<serial>
  format (mirrors question_uid's LMN-<SUBJECT>-<NODE>-<serial> exactly) — PASS
assembleForAttempt returned exactly 15 questions, all 15 confirmed (by an independent query, not
  trusting the function's own claim) to genuinely belong to phy_02 and no other chapter — PASS
startAttempt succeeded for a real student; assess.attempt_question has exactly 15 rows for it — PASS
```
Deviations / real bug found:
- **`is_current=true` was the wrong default** for a practice-test pattern — `catalog.exam_pattern` has
  a partial unique index allowing only one `is_current=true` row per `cycle_id` (the cycle's one
  official pattern). The first run of this proof hit that constraint immediately trying to create a
  second "current" pattern for the same cycle as the existing NEET_E2E_FIXTURE pattern. Fixed:
  practice-test patterns are created with `is_current=false` — `createTest()` never required
  `is_current` to begin with, only that the pattern and its sections exist and agree with each other.
- **Pattern reuse is single-line only.** A pattern_section carries `(subject_id, question_count)` but
  no node — node-scoping is entirely a `test_blueprint` (per-test) concern, not a pattern (shared
  shape) concern. That means one "15-question Physics practice" pattern is genuinely reusable across
  *every* Physics chapter/topic/unit, not just phy_02 — `createPracticeTest` searches for and reuses
  an existing single-section pattern of the exact (subject, count) shape before creating a new one.
  Multi-line (MOCK, several subjects in one test) always creates a fresh pattern; matching an exact
  multi-subject shape is a fuller search this function doesn't attempt yet.
- **No real full-mock (45-per-subject) pattern was created or attempted.** Live published-question
  counts per subject right now are 35/34/36/34 (Physics/Chemistry/Botany/Zoology) — short of NEET's
  real 45-per-subject section size. Flagged as a content gap for Prince (see docs/BUILD_LOG.md's next
  entry and the task list given to the user), not worked around by silently reducing the mock's size.
Next phase: Santhosh — HTTP routes for `createPracticeTest`/`assembleForAttempt` (currently db/-layer
only, zero HTTP surface for test creation exists anywhere, unlike attempt-taking); Prince — more
Botany/Zoology (and ideally Physics/Chemistry) content so a genuine 45-per-subject full mock becomes
possible.
