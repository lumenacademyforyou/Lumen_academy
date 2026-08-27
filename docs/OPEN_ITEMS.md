# Open items — repository/database vs brief §1.6/§1.7 (TE-P0)

Every place the live repository or live database contradicts LA-BE-ENGINE-001 §1.6 ("state of the
repository") or §1.7 ("expected repository paths"), one item per bullet: what the brief assumed,
what's actually true. Ground truth for all of these is `docs/DB_STATE.md` and this session's direct
reads of the repository — see that file for full detail; this file is the delta list only.

## Migrations and schema-authority (brief §1.6)

- **Brief assumed:** migrations `000_foundation` through `006_rules` applied, 47 tables across the
  five schemas. **Actual:** migrations `000`–`017` exist and are applied (18 files), file names
  don't match the brief's assumed set at all (there is no `006_rules`, no `007` partitioning
  migration — `007` here is `007_core_mobile_nullable.sql`), and the five schemas hold 60 tables +
  1 view (`catalog.v_section_marking`), not 47.
- **Brief assumed:** `009_core_rbac.sql`, `011_assess_scope.sql`, `013_content_import.sql` are
  "drafted, application state unknown." **Actual:** all three are applied and verified live (their
  tables/columns/data are present and populated where expected — `core.role` etc. from 009 has
  real seeded rows).
- **Brief assumed:** migration `007` is a deliberately-deferred partitioning migration, out of
  scope. **Actual:** no partitioning migration exists anywhere in `db/migrations/`. `007` in this
  repo is unrelated (`007_core_mobile_nullable.sql`). There is nothing "deferred" to point at.
- **Brief assumed:** `010_question_model.sql` and `012_question_variant.sql` are the verified
  canonical question model. **Actual:** no files with these names exist. The closest numbered files
  are `010_content_rich.sql` and `012_domain_checks.sql`, which are different migrations with
  different content — the brief is describing an earlier or different plan, not this repository.
- **Brief assumed:** a helper layer `000_template_helpers.sql` provides `upsert_concept`,
  `upsert_syllabus_node`, `map_node_concept`. **Actual:** no file by that name exists, and none of
  those three functions exist anywhere in the live database under any name (`docs/DB_STATE.md` §6).
- **Brief assumed:** a repository layer covers "all 47 entities." **Actual:** there are 60 tables
  in the five schemas, not 47, and the repository layer's actual coverage was not exhaustively
  re-verified table-by-table in this phase (out of TE-P0's scope per the brief's own item list —
  flagged here as a TE-P1 input, not answered).
- **Brief assumed:** no migration ledger table is mentioned as existing; TE-P0 is to check.
  **Actual:** confirmed none exists for the raw-SQL track — `public._prisma_migrations` is the only
  ledger table in the database, and it belongs solely to the Prisma track.

## The concept-tree / question-model design (brief §1.4, "not open for revision")

- **Brief assumed:** a question belongs to a canonical concept tree via `content.question_concept`,
  registered per-exam via `content.question_exam_usage`, resolved by `content.v_question_eligibility`.
  **Actual:** none of `content.concept`, `content.question_concept`, `content.question_exam_usage`,
  or `content.v_question_eligibility` exist. The live `content` schema instead maps a question
  directly to one `catalog.syllabus_node` via `content.question_node_map` — a materially different,
  simpler design with no concept-tree indirection layer at all. This is not a missing piece of an
  otherwise-matching design; it's a different design already built and applied.
- **Brief assumed:** identifiers follow `LMN-PHY-ROTMO-000001`, allocated atomically by
  `content.next_lumen_id()`. **Actual:** `content.question.question_uid` is a plain unique `text`
  column with no default, no sequence, no generator function anywhere in the database. Whatever
  writes a question row today must supply its own `question_uid` by whatever convention it chooses.
- **Brief assumed:** variants are one level deep via `variant_of_question_id`, enforced by trigger.
  **Actual:** `content.question` has no `variant_of_question_id` column at all, and none of the 10
  live triggers reference variants.
- **Brief assumed:** question content is atomised into `content.content_block` rows referencing
  `equation`/`asset`/`data_table`; no monolithic HTML column. **Actual:** there is no
  `content.content_block`, `content.equation`, or `content.data_table` table. `content.question` has
  a single `stem_text` column with a `stem_format` enum (`plain|markdown|latex|html`) — closer to
  "one formatted text column" than the atomised block model the brief describes as settled.
  `content.asset` exists and is closer to the brief's description for images/diagrams specifically.

## Prisma / dual-schema risk (brief §1.6, "highest-risk item")

- **Brief assumed:** "two coexisting schema definitions... a known drift risk," framed as something
  TE-P0 must assess for the first time. **Actual:** `docs/MIGRATION_STATE.md` (a prior session, dated
  2026-08-23) already assessed and applied both Prisma migrations, already flagged the
  converge/coexist/supersede question as open, and already made a narrower working decision for
  identity specifically (`core.app_user` canonical, `public.users` kept alive for FK reasons). TE-P0
  is not discovering this risk fresh — it's inheriting a partially-worked, still-open item.
- **Brief assumed:** Prisma targets only `public`, framed as basically dormant/at-risk of drift.
  **Actual:** the Prisma-backed `/api/tests/*` attempt flow is live, frontend-wired, and reachable
  by default in this environment's current `.env` unless `VITE_USE_REAL_API` is explicitly set to
  `"true"` (it currently is, in this session's `.env` — see `docs/ENGINE_STATE.md` §2). This is not
  a dormant schema; it's a second, currently-configurable-live attempt implementation.
- **Brief assumed (implicitly, by calling it "the" Prisma schema):** one migration history.
  **Actual:** 4 Prisma migration folders exist (`20260807095708_init`, `20260807162258_supabase_auth`,
  `20260820140818_schema_audit_upgrade`, `20260820142154_exam_pattern_model`), all 4 applied per
  `public._prisma_migrations`. `MIGRATION_STATE.md` itself only discusses the latter two — the first
  two pre-date that session's audit trail entirely.

## The three named defects (brief §1.6)

- **Brief assumed:** `option_id` is not validated against its owning question, framed as an open
  defect to fix. **Actual:** a live database trigger (`assess.trg_attempt_response_option_guard`)
  already prevents this at the schema layer on the raw-SQL attempt path, and the Prisma attempt
  path already validates it in application code. What's actually still broken is narrower: the
  trigger's rejection isn't mapped to a catalogued error code, so it surfaces as an unhandled 500
  instead of the clean 4xx R-6 requires. See `docs/ENGINE_STATE.md` §3(a) for the exact quote.
- **Brief assumed:** `submitAttempt` is not fully transactional, framed as present. **Confirmed
  present**, on both attempt paths (`docs/ENGINE_STATE.md` §3(b)) — this one is accurate as stated.
- **Brief assumed:** `attempt_no` allocation has a race, framed as present. **Confirmed present** on
  the raw-SQL path (`docs/ENGINE_STATE.md` §3(c)) — also accurate as stated, with the same
  unhandled-500 side effect as (a) once the unique constraint catches the collision.
- **Brief assumed (implicitly):** one attempt controller/service pair to check.
  **Actual:** three HTTP entry points exist for "attempt" (a retired stub, a live Prisma path, a
  live raw-SQL path), not the two the brief names (`attemptController`/`attemptFlowController`) —
  `attemptController.ts` is itself now dead (a 410 stub), and the real second live implementation is
  `backend/services/attempt.service.ts` behind `backend/routes/tests.routes.ts`, which the brief
  doesn't name at all. `db/assess/test/attempt/attempt.service.ts` (55 lines), which the brief does
  name, is unused dead code — the real raw-SQL logic is entirely in `attempt-flow.ts`.

## Expected repository paths (brief §1.7)

- **Brief expectation:** the listed paths as a complete/representative tree. **Actual:** `db/`
  alone has `assess/`, `catalog/`, `config/`, `content/`, `core/`, `learn/`, `migrations/`,
  `reports/`, `scripts/`, `shared/`, `verify/` subdirectories, plus three prior-session
  markdown docs at its root (`MIGRATION_STATE.md`, `CORE_LAYER_ENDPOINTS.md`,
  `CORE_LAYER_OPERATIONS.md`) — none of the latter three are anticipated by §1.7's table.
- **Brief expectation:** `db/assess/test/attempt/` holding `attempt-flow.ts` and related domain
  code. **Actual:** present as expected, plus `attempt.model.ts`, `attempt.repository.ts`,
  `attempt.service.ts` (dead), and `attempt_event/`/`attempt_response/`/`scorecard/` subdirectories
  the brief's flat listing doesn't show.
- **Brief expectation:** `backend/lib/` including `dbCrudRouter.ts`. **Confirmed present as
  expected** — `backend/lib/dbCrudRouter.ts` and `backend/lib/permissions.ts` both exist and are
  used (`makeOwnedCrudRouter` is imported by `backend/routes/assess.routes.ts`).
- **Not anticipated by §1.7 at all:** `backend/ai/`, `backend/generated/prisma/`,
  `backend/services/` (a whole layer — `adminUser.service.ts`, `attempt.service.ts`,
  `deleteAccount.service.ts`, `invitation.service.ts`, `meProfile.service.ts`,
  `pdfReport.service.ts`, `provisionUser.service.ts`, `userProfile.service.ts`), `prisma/`,
  `frontend/` (present as `frontend/`, not `src/frontend/` as §1.7 lists it), `database_sample/`
  (legacy mock question data, referenced only in a comment, not imported live),
  `schemas/v3/` — **this directory does not exist in the repository at all**, so the v3
  question-authoring JSON Schemas the brief's §1.5 describes as already-defined
  (`neet-ug.question-file.schema.json` etc.) are not present anywhere on disk.
- **`src/frontend/` vs `frontend/`:** the brief's §1.7 table lists `src/frontend/`; the actual
  directory is `frontend/` at the repository root, no `src/` wrapper.

## Data (not a §1.6/§1.7 path/schema item, but load-bearing for TE-P1's planning)

- **`docs/MIGRATION_STATE.md` (prior session, not the brief, but worth flagging the same way):**
  claimed persistent fixture data (an institution, a super_admin account, demo/e2e student accounts
  with attempt history) as "left live/persistent." None of it is present in the live database today
  — see `docs/DB_STATE.md` §8 for the full comparison. Whatever changed the data between
  2026-08-23 and now is unknown to this session; flagged for the project lead, not diagnosed here.
- **Brief §5 (I-8/I-9):** assumes a `platform_id` and `institution_id` for the pilot already exist
  to be handed over. **Actual:** `core.institution` is 0 rows live — there is currently no
  institution row of any kind to hand an ID for. I-9 cannot be satisfied by pointing at an existing
  row; one will need to be created.
