-- rollback_037_041_question_identity — reverses migrations 037-041.
--
-- Run order is the reverse of application. Idempotent throughout (if exists),
-- so a partial rollback can be re-run safely.
--
-- ****************************************************************************
-- IMPORTANT — this file does NOT un-retire clustered duplicates.
--
-- Dropping the identity columns does not restore the 67 rows the clustering
-- pass moved to lifecycle_status='duplicate_archived'. That is a DATA change
-- and it has its own dedicated, audited reversal, which must be run FIRST if
-- you want the bank back exactly as it was:
--
--     npx tsx db/scripts/backfill-question-identity.ts --restore <run_id>
--
-- The run_id is printed by the --execute run and is also recoverable from the
-- audit table at any time:
--
--     select distinct run_id, min(created_at), count(*)
--       from content.question_identity_audit
--      where action = 'cluster_retire'
--      group by run_id order by 2 desc;
--
-- Do the data restore before the schema drop, because the audit table itself
-- is dropped at the end of this file.
-- ****************************************************************************

begin;

-- 041 — the unique constraint.
drop index if exists content.uq_question_dedup;

-- 040 — usage tracking.
-- Dropping question_usage fires the per-row DELETE trigger, which would
-- decrement usage_count back toward its pre-migration value. That is the
-- correct reversal, but it is O(rows) — disable the trigger and reset the
-- column directly instead, which is equivalent and far faster.
alter table if exists content.question_usage disable trigger trg_question_usage_count;
drop table if exists content.question_usage;
drop function if exists content.trg_question_usage_count();
-- usage_count was 0 on every row before migration 040 (verified live), so
-- resetting to the default restores the exact prior state.
update content.question set usage_count = 0 where usage_count <> 0;

-- 039/038/037 — triggers first, so nothing recomputes while columns vanish.
drop trigger if exists trg_question_option_identity_sync on content.question_option;
drop trigger if exists trg_question_identity_sync on content.question;
drop function if exists content.trg_question_identity_sync();

drop function if exists content.fn_question_identity(uuid);
drop function if exists content.fn_question_answer_key(uuid);
drop function if exists content.fn_question_stem_norm(text);
drop function if exists content.fn_normalize_answer(text);
drop function if exists content.fn_question_detect_math(uuid);
drop function if exists content.fn_question_detect_table(uuid);

-- Layer 3 review queue.
drop table if exists content.question_duplicate_candidate;

-- Detection indexes.
drop index if exists content.ix_question_stem_norm_trgm;
drop index if exists content.ix_question_answer_key;
drop index if exists content.ix_question_dedup_key;
drop index if exists content.ix_question_canonical;

-- Identity columns.
alter table content.question
  drop column if exists stem_norm,
  drop column if exists answer_key,
  drop column if exists dedup_key,
  drop column if exists stem_vec,
  drop column if exists embed_model_version,
  drop column if exists image_phash;

-- The audit log goes LAST — everything above may need to be reversed with
-- reference to it, and the header warns to run --restore before this file.
drop table if exists content.question_identity_audit;

-- NOT DROPPED, deliberately:
--   * content.fn_normalize_stem and content.fn_question_fingerprints —
--     migration 030's, never modified by 037-041.
--   * content_fp / stem_fp / skeleton_fp columns and their triggers — same.
--   * has_math / has_table VALUES — 037's backfill recomputed these from
--     actual content because the stored flags were self-contradictory on
--     legacy rows (directive Bug 4). The recomputed values are more correct
--     than what they replaced, so they are left in place; restoring known-bad
--     metadata is not an improvement. Nothing depends on the old values.

commit;
