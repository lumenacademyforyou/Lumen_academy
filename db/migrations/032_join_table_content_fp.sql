-- 032_join_table_content_fp.sql
-- docs/no-repeat-questions-fix.md Phase 4. Denormalizes content_fp onto
-- both join tables the same way migration 027 denormalized test_id onto
-- assess.test_question — a UNIQUE constraint can't span a join, so the
-- value has to live on the row itself, kept correct by a trigger (not
-- trusted to every caller) rather than backfilled once and left to drift.
--
-- assess.test_question (Phase 4.1): UNIQUE(test_id, content_fp) added and
-- enforced. Checked live before writing this: zero pre-existing
-- (test_id, content_fp) collisions — safe to add outright, same "checked
-- before, would have blocked the migration otherwise" discipline as 027/031.
--
-- assess.attempt_question (Phase 4.2) — DELIBERATELY NOT a UNIQUE
-- constraint, decided with the user rather than guessed: a live check found
-- 128 of 774 real historical attempts (581 groups, one attempt with the
-- same visible question served 15 times) already violate
-- UNIQUE(attempt_id, content_fp) — direct historical proof of the bug this
-- whole directive exists to fix. Forcing that constraint through would mean
-- deleting or rewriting real students' served-question history, which this
-- migration does not do. content_fp is still added and indexed here (for
-- Phase 7's reporting and any future tooling), but the hard stop for NEW
-- attempts is Phase 3's assembler-level content_fp exclusion
-- (assemble.ts's pickedContentFps, already live and test-proven) — an
-- application-layer guarantee that already makes a new violation
-- structurally impossible, so the DB constraint here would only have been
-- defense-in-depth, not the primary guard. Revisit only if the app-layer
-- guarantee is ever found to have a real hole.

alter table assess.test_question add column if not exists content_fp bytea;
alter table assess.attempt_question add column if not exists content_fp bytea;

create or replace function assess.trg_test_question_set_content_fp() returns trigger as $$
begin
  select q.content_fp into new.content_fp from content.question q where q.question_id = new.question_id;
  if new.content_fp is null then
    raise exception 'assess.test_question: question_id % has no content_fp (content.question row missing or not yet backfilled)', new.question_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_test_question_set_content_fp on assess.test_question;
create trigger trg_test_question_set_content_fp
  before insert or update of question_id on assess.test_question
  for each row execute function assess.trg_test_question_set_content_fp();

create or replace function assess.trg_attempt_question_set_content_fp() returns trigger as $$
begin
  select q.content_fp into new.content_fp from content.question q where q.question_id = new.question_id;
  if new.content_fp is null then
    raise exception 'assess.attempt_question: question_id % has no content_fp (content.question row missing or not yet backfilled)', new.question_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_attempt_question_set_content_fp on assess.attempt_question;
create trigger trg_attempt_question_set_content_fp
  before insert or update of question_id on assess.attempt_question
  for each row execute function assess.trg_attempt_question_set_content_fp();

-- Backfill both tables for rows that already exist.
update assess.test_question tq
   set content_fp = q.content_fp
  from content.question q
 where q.question_id = tq.question_id and tq.content_fp is null;

update assess.attempt_question aq
   set content_fp = q.content_fp
  from content.question q
 where q.question_id = aq.question_id and aq.content_fp is null;

alter table assess.test_question alter column content_fp set not null;
alter table assess.attempt_question alter column content_fp set not null;

alter table assess.test_question drop constraint if exists uq_test_question_test_content;
alter table assess.test_question
  add constraint uq_test_question_test_content unique (test_id, content_fp);

-- Plain index only (not unique) — see header comment for why.
create index if not exists ix_attempt_question_content_fp on assess.attempt_question (attempt_id, content_fp);

insert into util.applied_migration (migration_name) values ('032_join_table_content_fp')
on conflict (migration_name) do nothing;
