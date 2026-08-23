# Migration state
_Last updated: 2026-08-23 by Session A (audit and reset)_

## Database state
**State: B — partly migrated beyond the committed baseline.**

Evidence: all seven newer-brief-only objects exist live in the database —
`catalog.node_level`, `catalog.exam_family`, `core.role`, `core.user_role_assignment`,
`content.question_group`, `content.question_source`, `assess.test_scope_node`, plus
columns `catalog.syllabus_node.node_path`, `assess.test.scope_type`,
`content.question.external_ref`. None of this is possible under STATE A. Every DDL
object defined by migrations 008–013 is present, even though none of those six
migration files (or their verify files) are committed to git — they are untracked.
The database is ahead of what git has recorded.

There is no ledger for the raw-SQL migration runner (`db/scripts/run-migration.mjs`
runs a file and its verify script with no bookkeeping of its own), so "applied"
below is inferred entirely from live object presence + verify-script results
gathered this session (all verify scripts are read-only assertions — confirmed by
reading their SQL before running).

## Applied
| Migration | Applied | Verified | Notes |
|---|---|---|---|
| 000_foundation.sql | yes | yes | |
| 001_catalog.sql | yes | yes | |
| 002_core.sql | yes | **stale check** | verify_002 asserts `uq_app_user_mobile_number` is a UNIQUE **constraint**. Migration 007 (already-committed, intentional, documented) dropped that constraint and replaced it with an equivalent partial unique **index** of the same name. Schema is correct; verify_002 was never updated after 007 shipped. Not schema corruption. |
| 003_content.sql | yes | yes | |
| 004_assess.sql | yes | yes | |
| 005_learn.sql | yes | yes | |
| 006_pgvector_index.sql | yes | yes | |
| 007_core_mobile_nullable.sql | yes | yes | this is the migration that makes verify_002 stale (see above) |
| 008_catalog_taxonomy.sql | yes (uncommitted) | yes | functional proof passed; proof rows rolled back |
| 009_core_rbac.sql | yes (uncommitted) | yes | functional proof passed; proof rows rolled back |
| 010_content_rich.sql | yes (uncommitted) | **FAILED** | schema objects all present (first assertion block passed), but the verify script's own functional-proof step inserts `content.ai_generation_job.job_type = 'verify_proof'`, which is not in the allowed list `('manual_import','question_generation','translation','review_assist','other')` added later by migration 012's `ck_ai_generation_job_type` check constraint. Real cross-migration ordering bug: 010's verify script predates 012's constraint and was never updated to match. Needs a person to decide the fix (change the verify script's literal, or add an allowed value) — not something to silently patch. |
| 011_assess_scope.sql | yes (uncommitted) | yes | functional proof passed; proof rows rolled back |
| 012_domain_checks.sql | yes (uncommitted) | yes | functional proof passed; proof rows rolled back |
| 013_content_import.sql | yes (uncommitted) | yes | functional proof passed |

## Objects present that no committed migration created
All of the following exist live but come from untracked files (008–013):

- `catalog.exam_family`, `catalog.node_level`, `catalog.syllabus_node.node_path` (+ related unique/prefix indexes and hierarchy triggers) — **008_catalog_taxonomy.sql**
- `core.role`, `core.role_permission`, `core.user_role_assignment` (+ scope/audit/last-super_admin-revoke guard triggers) — **009_core_rbac.sql**
- `content.question_group`, `content.question_source`, `content.question.external_ref`, `content.question.group_id`, `content.asset.group_id` — **010_content_rich.sql**
- `assess.test.scope_type`, `assess.test_scope_node` (+ cross-exam consistency trigger) — **011_assess_scope.sql**
- Domain check constraints across assess/catalog/core, incl. `ck_ai_generation_job_type`, `ck_ai_generation_job_status`, `ck_question_review_reviewer_type`, `ck_question_translation_review_status` — **012_domain_checks.sql**
- `content.import_batch`, `content.import_row` (checksum + batch/row_no uniqueness) — **013_content_import.sql**

Separately, uncommitted working-tree changes exist on top of all this:
`.env.example` (+7 lines), `db/scripts/run-migration.mjs` (SSL-detection fix for the
Supabase pooler host, per its own inline comment), and `prisma/schema.prisma`
(570-line diff). Two new Prisma migration folders also sit on disk —
`20260820140818_schema_audit_upgrade` and `20260820142154_exam_pattern_model` —
but neither appears in the `public._prisma_migrations` ledger (which still lists
only `20260807095708_init` and `20260807162258_supabase_auth`), so neither has been
deployed via Prisma. Whether the schema.prisma diff is meant to mirror 008–013 or
is separate, not-yet-applied work is unclear from evidence alone — flagged below.

## Existing assess data
Two accounts own all `assess` data, both unambiguously seed/test accounts, not
real users:

| email | attempts | scorecards | first | last |
|---|---|---|---|---|
| demo.student@lumenacademy.dev | 8 | 6 | 2026-08-16T16:11:23Z | 2026-08-16T16:21:19Z |
| e2e-test-student@lumen.internal | 2 | 1 | 2026-08-16T15:40:54Z | 2026-08-16T15:48:25Z |

Disposable. Nothing was deleted this session.

## Open decisions blocking the next session
1. **Commit or discard 008–013 + their verify files.** They are fully applied and
   (mostly) verified live but sit uncommitted in git. If they're kept, they should
   be committed migration-by-migration per the session rules below, not as one bulk
   commit, since no per-migration commit trail exists yet.
2. **Fix verify_010_content_rich vs. 012's `ck_ai_generation_job_type` constraint.**
   Decide whether to change the verify script's proof literal or extend the allowed
   `job_type` values — this is a real bug, not stale-script noise like 002.
3. **Fix or retire verify_002_core's stale constraint assertion** (checks for a
   UNIQUE constraint that 007 intentionally replaced with a partial index).
4. **Reconcile the two migration systems.** Raw SQL migrations (008–013, applied
   directly to the DB) and Prisma migrations (`schema_audit_upgrade`,
   `exam_pattern_model`, present on disk but not deployed, plus the uncommitted
   570-line `schema.prisma` diff) both exist and are out of sync. Decide which is
   authoritative going forward, and whether the two pending Prisma migrations
   should be deployed, rewritten, or dropped.
5. **`.env.example` and `run-migration.mjs` diffs** are uncommitted and untested
   against this report — no evidence gathered either way; just noting they exist.

## Next session should
Read this file first, then get a person's decision on items 1–4 above before
applying, committing, or altering anything — this audit applied no migrations and
changed no schema.
