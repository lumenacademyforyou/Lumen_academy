-- 031_collapse_duplicate_questions.sql
-- docs/no-repeat-questions-fix.md Phase 2. Migration 030 gave every
-- published question a content_fp; docs/POOL_CENSUS.md shows 1399 published
-- rows collapse to 643 real ones (94 duplicate content_fp groups). Rows are
-- never deleted — assess.test_question and assess.attempt_question hold FKs
-- to them and historical attempts must stay reconstructible byte-for-byte —
-- so non-canonical rows are relabelled 'duplicate_archived' instead, which
-- Phase 3's assembler (still filtering on lifecycle_status = 'published')
-- excludes automatically with no query change needed there.
--
-- Scope: content_fp groups among lifecycle_status = 'published' rows only.
-- The one live 'retired' row is left untouched — it's already out of the
-- candidate pool and relabelling it would be a status regression this
-- migration has no reason to make.
--
-- Canonical pick, in order (Phase 2.1): highest revision_no, then non-null
-- solution_text, then has_image/has_table/has_math richness, then lowest
-- question_id as a stable tiebreak so re-running this migration is a no-op
-- (idempotent) rather than picking a different survivor each time.

alter table content.question drop constraint if exists ck_question_lifecycle;
alter table content.question add constraint ck_question_lifecycle
  check (lifecycle_status in ('draft','in_review','approved','published','retired','duplicate_archived'));

alter table content.question
  add column if not exists canonical_question_id uuid references content.question (question_id);

-- 2.3a. Merge usage_count onto the canonical row (sum across the group)
-- before archiving — computed from the still-all-'published' group so the
-- grouping predicate below and this one agree on membership.
with grp as (
  select content_fp, sum(usage_count) as total_usage
    from content.question
   where lifecycle_status = 'published'
   group by content_fp
  having count(*) > 1
),
ranked as (
  select question_id, content_fp,
         row_number() over (
           partition by content_fp
           order by revision_no desc nulls last,
                    (solution_text is not null) desc,
                    (coalesce(has_image, false)::int + coalesce(has_table, false)::int + coalesce(has_math, false)::int) desc,
                    question_id asc
         ) as rn
    from content.question
   where lifecycle_status = 'published'
)
update content.question q
   set usage_count = grp.total_usage
  from grp, ranked r
 where q.question_id = r.question_id and r.rn = 1 and r.content_fp = grp.content_fp;

-- 2.1/2.2. Archive every non-canonical row in a >1 group, pointing it at
-- the canonical survivor computed by the same ranking.
with ranked as (
  select question_id, content_fp,
         row_number() over (
           partition by content_fp
           order by revision_no desc nulls last,
                    (solution_text is not null) desc,
                    (coalesce(has_image, false)::int + coalesce(has_table, false)::int + coalesce(has_math, false)::int) desc,
                    question_id asc
         ) as rn,
         first_value(question_id) over (
           partition by content_fp
           order by revision_no desc nulls last,
                    (solution_text is not null) desc,
                    (coalesce(has_image, false)::int + coalesce(has_table, false)::int + coalesce(has_math, false)::int) desc,
                    question_id asc
         ) as canonical_id
    from content.question
   where lifecycle_status = 'published'
)
update content.question q
   set lifecycle_status = 'duplicate_archived',
       canonical_question_id = r.canonical_id
  from ranked r
 where q.question_id = r.question_id and r.rn > 1;

-- 2.3b. Remap assess.user_question_seen onto canonical ids. Without this, a
-- student who was served an archived clone still sorts as fully "unseen"
-- for the canonical row (assemble.ts's LINE_CANDIDATE_SQL LEFT JOINs on
-- exact question_id) and would be served the same visible content again.
-- Aggregated through a temp table rather than a plain UPDATE, since two
-- different rows the same user saw (e.g. the canonical directly, plus one
-- archived clone) collapse onto the same (user_id, question_id) PK and must
-- be pre-merged before the rewrite, not after — an UPDATE hitting the PK
-- twice would raise 23505, not silently overwrite.
--
-- Per Phase 2.3's own spec: last_seen_at takes the EARLIEST value across a
-- merged group (deliberate — an already-collapsed-content question that
-- was first seen a while ago should sort as available-to-recycle sooner
-- than "just seen", not reset to looking fresh). times_seen and
-- last_seen_attempt_seq are summed/maxed (no serve event should be lost by
-- the merge); was_correct_last is taken from whichever original row had the
-- latest last_seen_at, since "was this last attempt correct" is a recency
-- question the merge's own last_seen_at choice deliberately doesn't answer.
create temp table tmp_uqs_merged on commit drop as
with archived_map as (
  select question_id as old_id, canonical_question_id as new_id
    from content.question
   where lifecycle_status = 'duplicate_archived'
)
select
  coalesce(m.new_id, uqs.question_id) as question_id,
  uqs.user_id,
  min(uqs.first_seen_at) as first_seen_at,
  min(uqs.last_seen_at) as last_seen_at,
  sum(uqs.times_seen) as times_seen,
  max(uqs.last_seen_attempt_seq) as last_seen_attempt_seq,
  (array_agg(uqs.was_correct_last order by uqs.last_seen_at desc))[1] as was_correct_last
from assess.user_question_seen uqs
left join archived_map m on m.old_id = uqs.question_id
group by coalesce(m.new_id, uqs.question_id), uqs.user_id;

truncate assess.user_question_seen;
insert into assess.user_question_seen
  (user_id, question_id, first_seen_at, last_seen_at, times_seen, last_seen_attempt_seq, was_correct_last)
select user_id, question_id, first_seen_at, last_seen_at, times_seen, last_seen_attempt_seq, was_correct_last
  from tmp_uqs_merged;

-- v_question_eligibility (referenced by Phase 2.3's spec text) does not
-- exist in this schema — grepped, confirmed zero views reference
-- content.question at all. Every real consumer filters
-- lifecycle_status = 'published' directly (assemble.ts's LINE_CANDIDATE_SQL/
-- LINE_AVAILABLE_SQL, questionController.ts, catalogTreeController.ts,
-- sessionController.ts) and excludes 'duplicate_archived' automatically —
-- no query change needed anywhere for this to take effect.

insert into util.applied_migration (migration_name) values ('031_collapse_duplicate_questions')
on conflict (migration_name) do nothing;
