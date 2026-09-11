-- rollback_044_dedup_toolkit — undoes 044_dedup_toolkit.sql.
--
-- SCHEMA ONLY. Run the DATA reversal first if a dedup run has already
-- soft-deleted rows:
--
--     npx tsx db/scripts/dedup/cli.ts rollback --run-id <id> --apply
--
-- Dropping content.question_dedup_repoint before that reversal destroys the
-- record of where every moved foreign key came from. Order matters.
--
-- WHAT THIS RESTORES AND WHAT IT DOES NOT
-- ---------------------------------------
-- 044 extends three structures that existed before it. This file removes the
-- columns it added and recreates the index it dropped, but it deliberately
-- does NOT delete data:
--
--   * content.question_identity_audit keeps its rows. Only the four columns
--     044 added are dropped, so the 1467 pre-existing audit rows and any
--     'cluster_retire' rows a dedup run wrote survive intact — minus their
--     tier / similarity / payload / actor detail, which is the price of
--     rolling the schema back.
--   * content.import_batch likewise keeps every row.
--   * lifecycle_status and canonical_question_id are untouched. They predate
--     this migration (030/031/037-041 own them) and a dedup run's effect on
--     them is undone by the data reversal above, not by dropping a column.
--
-- uq_question_dedup is recreated with migration 041's exact definition, so a
-- rollback leaves the bank under the constraint it had before 044.

begin;

drop index if exists content.uq_question_match_hash;

alter table content.question
  drop column if exists match_hash,
  drop column if exists is_deleted,
  drop column if exists merged_into_id,
  drop column if exists deleted_at,
  drop column if exists dedup_cluster_id;

-- Restore migration 041's index, which 044 dropped as subsumed. Recreated
-- only if the data still permits it — if a dedup run has since published rows
-- that share a dedup_key, this will fail loudly rather than silently skip,
-- which is the correct outcome: the operator needs to know.
create unique index if not exists uq_question_dedup
  on content.question (dedup_key)
  where lifecycle_status = 'published' and canonical_question_id is null;

alter table content.question_identity_audit
  drop column if exists tier,
  drop column if exists similarity_score,
  drop column if exists payload_json,
  drop column if exists actor;

drop index if exists content.ix_question_identity_audit_run;

alter table content.import_batch
  drop column if exists duplicate_count,
  drop column if exists detail;

drop table if exists content.question_dedup_repoint;

drop function if exists content.fn_try_dedup_lock();
drop function if exists content.fn_release_dedup_lock();

commit;
