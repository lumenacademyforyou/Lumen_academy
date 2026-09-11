-- 040_question_usage — Layer 4 of question-dedup-audit-and-fix.md.
--
-- WHAT WAS ACTUALLY MISSING
-- -------------------------
-- The audit (docs/QUESTION_DEDUP_AUDIT.md §1.3) found the assembler already
-- does most of Layer 4: it excludes question_id, content_fp AND skeleton_fp
-- across every blueprint line in a paper, sorts unseen-first per user via
-- assess.user_question_seen, uses a fresh random seed per attempt, and
-- fail-loud asserts on content_fp before persisting.
--
-- Three things were genuinely absent:
--   1. usage_count is NEVER incremented — confirmed 0 on all 1400 rows. There
--      is no global rotation signal, so "prefer the least-used question" is
--      impossible to express.
--   2. No usage-history table at all. assess.user_question_seen is per-USER;
--      nothing records that a question went out on a given paper, so cooldown
--      cannot be reasoned about per audience.
--   3. Nothing reads canonical_question_id at selection time.
--
-- COHORT
-- ------
-- core.batch / core.batch_member model cohorts and are BOTH EMPTY (0 rows) on
-- this database. cohort_id is therefore nullable and resolved best-effort. It
-- is not fabricated: when a user belongs to no batch the column is NULL and
-- the assembler's cooldown falls back to per-user exclusion, which is what
-- assess.user_question_seen already provides and is strictly stricter than a
-- per-cohort rule. The per-cohort path activates on its own the moment
-- batches are populated, with no further migration.
--
-- usage_count is maintained BY TRIGGER, not by application code, for the same
-- reason the identity columns are: an importer or a manual session cannot get
-- it wrong, and the increment lands in the same transaction as the usage row,
-- so a rolled-back generation can never inflate a count.

begin;

create table if not exists content.question_usage (
  usage_id     bigint generated always as identity primary key,
  question_id  uuid not null references content.question (question_id),
  canonical_id uuid not null,
  paper_id     uuid not null,
  user_id      uuid references core.app_user (user_id) on delete set null,
  cohort_id    uuid references core.batch (batch_id),
  used_at      timestamptz not null default now()
);

comment on table content.question_usage is
  'One row per question per generated paper. paper_id is assess.attempt.attempt_id — in BLUEPRINT mode the attempt IS the served paper (assess.test is only the template). cohort_id is core.batch.batch_id when the user belongs to a batch, else NULL (no batches exist yet; cooldown then falls back to per-user).';
comment on column content.question_usage.canonical_id is
  'coalesce(canonical_question_id, question_id) at serve time — denormalised so the cooldown query never has to join back to content.question.';

-- The cooldown lookup: "what has this cohort (or user) seen recently".
create index if not exists ix_question_usage_cohort_recent
  on content.question_usage (cohort_id, canonical_id, used_at desc);
create index if not exists ix_question_usage_user_recent
  on content.question_usage (user_id, canonical_id, used_at desc);
create index if not exists ix_question_usage_paper
  on content.question_usage (paper_id);
-- One row per (question, paper): a retry of the same generation is idempotent
-- and can never double-count usage.
create unique index if not exists uq_question_usage_paper_question
  on content.question_usage (paper_id, question_id);

-- ---------------------------------------------------------------------------
-- usage_count maintenance, by trigger
-- ---------------------------------------------------------------------------
create or replace function content.trg_question_usage_count()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    -- Count against the CANONICAL row: two variants of one question are one
    -- logical item, and rotation should treat them as such.
    update content.question
       set usage_count = usage_count + 1
     where question_id = new.canonical_id;
    return new;
  elsif tg_op = 'DELETE' then
    update content.question
       set usage_count = greatest(usage_count - 1, 0)
     where question_id = old.canonical_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_question_usage_count on content.question_usage;
create trigger trg_question_usage_count
  after insert or delete on content.question_usage
  for each row execute function content.trg_question_usage_count();

-- ---------------------------------------------------------------------------
-- Backfill usage history from attempts that already happened
-- ---------------------------------------------------------------------------
-- Without this, cooldown starts blind and every student's next paper looks
-- brand new. assess.attempt_question is the served-paper record for every
-- past attempt, so the history already exists — it just was never projected
-- into a usage table. Idempotent via the unique index.
insert into content.question_usage (question_id, canonical_id, paper_id, user_id, cohort_id, used_at)
select aq.question_id,
       coalesce(q.canonical_question_id, aq.question_id),
       aq.attempt_id,
       a.user_id,
       (select bm.batch_id
          from core.batch_member bm
         where bm.user_id = a.user_id and bm.left_on is null
         limit 1),
       coalesce(a.submitted_at, a.started_at)
  from assess.attempt_question aq
  join assess.attempt a on a.attempt_id = aq.attempt_id
  join content.question q on q.question_id = aq.question_id
on conflict (paper_id, question_id) do nothing;

commit;
