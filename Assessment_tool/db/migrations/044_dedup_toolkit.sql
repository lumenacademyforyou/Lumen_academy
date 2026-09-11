-- 044_dedup_toolkit — schema for question-dedup-promptnew.md (Phases 2, 5, 6).
--
-- RUN 043_stem_norm_dash_fold.sql FIRST. This is an ordering requirement, not
-- a preference, and getting it wrong fails silently:
--
--   `match_hash` below is a STORED generated column over
--   content.fn_question_stem_norm(stem_text). Postgres materialises a stored
--   generated column when the column is added and on every row write --- it
--   does NOT re-evaluate it when a function the expression calls is later
--   redefined. So if this migration runs before 043, every dash-bearing stem
--   keeps a hash computed by the OLD normaliser, and that stale value is what
--   uq_question_match_hash indexes. Two questions differing only in dash
--   character would then still be allowed to coexist, which is the exact
--   thing the index exists to prevent.
--
--   This was found by db/scripts/dedup/integration.test.ts, which applies both
--   migrations inside a rolled-back transaction and compares the resulting
--   column against the TypeScript hash for all 533 published rows. In the
--   wrong order it reported exactly one mismatch: LMN-PHY-PHY02-000125,
--   "...voltmeter of range 0-5 V", spelled with an en dash.
--
--
-- THIS MIGRATION EXTENDS EXISTING STRUCTURES RATHER THAN ADDING PARALLEL ONES
-- ==========================================================================
-- An earlier draft of this file created content.question_dedup_audit and
-- content.ingestion_run, and left migration 041's uq_question_dedup in place
-- beside the new index. All three were duplication: this schema already had a
-- home for every one of them, with real history in it. That draft was rolled
-- back before anything depended on it and replaced by what follows.
--
--   question_dedup_audit  -> content.question_identity_audit ALREADY EXISTS
--       (migration 037, 1467 rows) with question_id, run_id, action,
--       old/new_lifecycle, old/new_canonical, old/new_dedup_key, note,
--       created_at. Its action CHECK already allows 'cluster_retire' and
--       'cluster_restore' — precisely what a dedup run does — and
--       new_canonical is the survivor. Only four columns were genuinely
--       missing, so four columns are added below. A second audit table would
--       have split one question's history across two places, which is the
--       failure mode audit trails exist to prevent.
--
--   ingestion_run         -> content.import_batch ALREADY EXISTS (43 rows,
--       one per batch file ever imported) with batch_label, source_file,
--       file_checksum, batch_status, row_count, accepted_count,
--       rejected_count, started_at, finished_at. Its status CHECK already
--       allows 'loaded' / 'failed' / 'rolled_back'. Two columns were missing.
--
--   uq_question_dedup     -> DROPPED below. It is strictly subsumed by the
--       new index; keeping both would mean two constraints expressing
--       overlapping rules, where the weaker one can only ever fire second.
--
-- Idempotent throughout. Safe to re-run.
--
--
-- WHY THREE OF THE PROMPT'S COLUMNS ARE GENERATED, NOT WRITABLE
-- ------------------------------------------------------------
-- The prompt asks for `is_deleted`, `deleted_at`, `dedup_cluster_id` and
-- `merged_into_id` on the questions table. Two of those already exist here
-- under different names and are already load-bearing:
--
--     is_deleted      == lifecycle_status = 'duplicate_archived'
--     merged_into_id  == canonical_question_id
--
-- and the live assembler filters on `lifecycle_status` (db/assess/test/
-- generation/assemble.ts), not on any new flag. Adding independently-writable
-- copies would create a second source of truth for "is this question
-- servable?", and the failure mode is not hypothetical: a row set
-- is_deleted = true while lifecycle_status stayed 'published' would keep
-- being served into live papers with nothing in the system disagreeing.
--
-- So `is_deleted` and `merged_into_id` are GENERATED ALWAYS ... STORED over
-- the existing columns. The prompt's column names exist and can be queried
-- exactly as its reports expect; they cannot drift from the columns the
-- engine actually reads, because the database computes them.
--
-- `deleted_at` and `dedup_cluster_id` are new information that nothing else
-- records, so those are ordinary writable columns.

begin;

-- ---------------------------------------------------------------------------
-- 1. Soft-delete surface on content.question
-- ---------------------------------------------------------------------------

alter table content.question
  add column if not exists deleted_at       timestamptz,
  add column if not exists dedup_cluster_id text;

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'content' and table_name = 'question' and column_name = 'is_deleted'
  ) then
    alter table content.question
      add column is_deleted boolean
      generated always as (lifecycle_status = 'duplicate_archived') stored;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'content' and table_name = 'question' and column_name = 'merged_into_id'
  ) then
    alter table content.question
      add column merged_into_id uuid
      generated always as (canonical_question_id) stored;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'content' and table_name = 'question' and column_name = 'match_hash'
  ) then
    -- digest(text, text) not digest(bytea, text): the bytea overload would
    -- need convert_to(), which Postgres declares STABLE (it depends on the
    -- database encoding), and a STORED generated column requires an
    -- IMMUTABLE expression. The text overload hashes the server-encoding
    -- bytes directly. This database is UTF8, so those are the same bytes
    -- db/scripts/dedup/normalize.ts hashes — asserted, not assumed, by
    -- db/scripts/dedup/integration.test.ts, which compares this column
    -- against the TypeScript hash for every published row.
    alter table content.question
      add column match_hash bytea
      generated always as (
        digest(content.fn_question_stem_norm(stem_text), 'sha256')
      ) stored;
  end if;
end $$;

comment on column content.question.is_deleted is
  'GENERATED from lifecycle_status. Read-only by design — writing a soft delete means setting lifecycle_status to duplicate_archived, which is what the assembler actually filters on. See migration 044 header.';
comment on column content.question.merged_into_id is
  'GENERATED from canonical_question_id. The survivor this row was merged into.';
comment on column content.question.deleted_at is
  'When the dedup run soft-deleted this row. NULL for live rows and for the 866 rows retired by earlier passes, which predate this column.';
comment on column content.question.dedup_cluster_id is
  'Cluster this row belonged to in the run that retired it. Scoped to a run_id in content.question_identity_audit.';
comment on column content.question.match_hash is
  'GENERATED sha256(fn_question_stem_norm(stem_text)). THE STEM IS THE ONLY INPUT — options and answers are deliberately excluded (question-dedup-promptnew.md section 2). Mirrored in TypeScript by db/scripts/dedup/normalize.ts matchHash(); db/scripts/dedup/integration.test.ts asserts the two agree on every live row.';

-- ---------------------------------------------------------------------------
-- 2. The stem-only UNIQUE index — Phase 6's real safety net
-- ---------------------------------------------------------------------------
--
-- "Enforce idempotency at the database level ... This is the real safety net —
-- application-side checks race, constraints don't."
--
-- Partial on published rows: an archived duplicate must be allowed to sit
-- next to its survivor, or the soft delete could not be represented at all.

create unique index if not exists uq_question_match_hash
  on content.question (match_hash)
  where lifecycle_status = 'published';

comment on index content.uq_question_match_hash is
  'One published question per normalised stem. Makes INSERT ... ON CONFLICT (match_hash) DO NOTHING a real guarantee rather than an application convention. Supersedes migration 041''s uq_question_dedup, which this migration drops.';

-- ---------------------------------------------------------------------------
-- 3. Retire migration 041's uq_question_dedup — strictly subsumed
-- ---------------------------------------------------------------------------
--
-- 041 keyed on dedup_key = sha256(stem_norm, sorted options, answer_key,
-- image_phash, question_type). The new index keys on the stem alone. The
-- stem-only key is stronger on every axis, so the old index can never be the
-- one that fires first:
--
--   * SUBSUMPTION. dedup_key is derived FROM stem_norm, so any two published
--     rows with equal dedup_key necessarily have equal stem_norm and equal
--     match_hash. Every violation uq_question_dedup could catch,
--     uq_question_match_hash catches too.
--   * BROADER PREDICATE. 041's index is partial on
--     `lifecycle_status = 'published' AND canonical_question_id IS NULL`;
--     the new one drops the second clause, so it also covers published rows
--     that carry a canonical pointer.
--   * NO NULL ESCAPE HATCH. dedup_key is NULL whenever answer_key is NULL
--     (a question with no determinable answer), and NULLs are exempt from a
--     unique index. match_hash is never NULL.
--
-- Keeping both would leave a weaker constraint that can only ever report
-- second, on a subset, with a less useful error. Dropped rather than kept
-- "for safety" — two overlapping rules for one invariant is how the two
-- drift apart.

drop index if exists content.uq_question_dedup;

-- ---------------------------------------------------------------------------
-- 4. Extend the EXISTING audit trail (content.question_identity_audit)
-- ---------------------------------------------------------------------------
--
-- Migration 037 built this table and the identity backfill filled it with
-- 1467 rows. A dedup run already maps onto it cleanly:
--
--     action        'cluster_retire' / 'cluster_restore' (already in its CHECK)
--     run_id        the dedup run
--     question_id   the row removed
--     new_canonical the survivor
--     note          the reason
--
-- Only these four were missing.

alter table content.question_identity_audit
  add column if not exists tier             smallint,
  add column if not exists similarity_score numeric(6,5),
  add column if not exists payload_json     jsonb,
  add column if not exists actor            text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'content.question_identity_audit'::regclass
       and conname = 'ck_question_identity_audit_tier'
  ) then
    alter table content.question_identity_audit
      add constraint ck_question_identity_audit_tier check (tier is null or tier in (1, 2, 3));
  end if;
end $$;

comment on column content.question_identity_audit.tier is
  'Which dedup tier retired this row: 1 exact stem, 2 near-identical stem, 3 human-reviewed. NULL for rows written by the migration-037 identity backfill, which predates tiering.';
comment on column content.question_identity_audit.similarity_score is
  'Lowest pairwise similarity inside the cluster this row belonged to. 1 for a Tier-1 cluster, NULL for backfill rows.';
comment on column content.question_identity_audit.payload_json is
  'Complete snapshot of the removed row and its owned children (options, solution, translations) at removal time. This is what `dedup-cli rollback` replays, and what makes `--purge` survivable: once a row is hard-deleted the snapshot is the only copy left.';
comment on column content.question_identity_audit.actor is
  'Who or what performed the action. NULL for backfill rows.';

create index if not exists ix_question_identity_audit_run
  on content.question_identity_audit (run_id);

-- ---------------------------------------------------------------------------
-- 5. Foreign-key re-pointing ledger — genuinely new, no existing equivalent
-- ---------------------------------------------------------------------------
--
-- Section 3: "Before deleting a loser, re-point its foreign keys (attempts,
-- test_questions, bookmarks, analytics) to the survivor."
--
-- Re-pointing is destructive in a way soft-deleting the question is not: the
-- old value is overwritten in place in a table this toolkit does not own.
-- Rollback therefore needs a record of every single row moved, not just of
-- the questions retired. Nothing in this schema recorded that before.

create table if not exists content.question_dedup_repoint (
  id           bigint generated always as identity primary key,
  run_id       uuid        not null,
  table_name   text        not null,
  column_name  text        not null,
  pk_json      jsonb       not null,
  from_id      uuid        not null,
  to_id        uuid        not null,
  created_at   timestamptz not null default now()
);

create index if not exists ix_question_dedup_repoint_run on content.question_dedup_repoint (run_id);

comment on table content.question_dedup_repoint is
  'One row per foreign-key reference moved from a retired question onto its survivor. Replayed in reverse by `dedup-cli rollback`.';

-- ---------------------------------------------------------------------------
-- 6. Extend the EXISTING ingestion ledger (content.import_batch)
-- ---------------------------------------------------------------------------
--
-- Phase 6 asks for an `ingestion_runs` table. content.import_batch is that
-- table under this schema's own name, already carrying 43 rows — one per
-- batch file ever imported — with source_file, file_checksum, row_count,
-- accepted_count, rejected_count, started_at, finished_at, and a status
-- CHECK that already allows 'loaded', 'failed' and 'rolled_back'.
--
-- A push run is an import. Recording it anywhere else would mean the history
-- of "how did content get into this bank" lived in two tables that no query
-- joins.

alter table content.import_batch
  add column if not exists duplicate_count integer not null default 0,
  add column if not exists detail          jsonb;

comment on column content.import_batch.duplicate_count is
  'Rows skipped by ON CONFLICT DO NOTHING because an identical stem was already published. Distinct from rejected_count, which counts rows that failed validation.';
comment on column content.import_batch.detail is
  'Free-form run detail: pre/post counts, verification outcome, or the error that caused a rollback.';

-- ---------------------------------------------------------------------------
-- 7. Advisory lock helper
-- ---------------------------------------------------------------------------
--
-- Section 5 (Isolation): "Take an advisory lock so two dedup runs can't
-- overlap." The key is a fixed hash of the string 'question_dedup' so every
-- entry point competes for the same lock without coordinating on a constant.

create or replace function content.fn_try_dedup_lock()
returns boolean
language sql
as $$
  select pg_try_advisory_lock(hashtext('question_dedup')::bigint);
$$;

create or replace function content.fn_release_dedup_lock()
returns boolean
language sql
as $$
  select pg_advisory_unlock(hashtext('question_dedup')::bigint);
$$;

commit;
