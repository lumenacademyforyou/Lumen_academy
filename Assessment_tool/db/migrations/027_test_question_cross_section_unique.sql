-- 027_test_question_cross_section_unique.sql
-- Test-layer hardening A1 (docs/test-layer-hardening-prompt.md,
-- docs/BUGS.md#A1, docs/AUDIT.md §1.1). Hard Rule #1: "no question appears
-- twice inside one test — not across sections, not across groups, not via
-- two eligibility paths." Confirmed live during the audit that the only
-- existing constraint, uq_test_question_section_question (011_assess_scope),
-- is scoped to (test_section_id, question_id) — two different sections of
-- the same test can legally hold the same question_id, and the only thing
-- stopping it today is application code (ingestFixedPaper's own firstSeenAt
-- map), not the database, and that check has no reach over any other write
-- path (e.g. assess.test_question's generic repository insert).
--
-- assess.test_question has no test_id column at all (only test_section_id)
-- so a direct UNIQUE(test_id, question_id) isn't expressible without one.
-- Denormalizing test_id onto the row, kept in sync by a trigger rather than
-- trusted to every caller, closes this at the one place no application code
-- can route around it.

alter table assess.test_question add column if not exists test_id uuid;

update assess.test_question tq
   set test_id = ts.test_id
  from assess.test_section ts
 where ts.test_section_id = tq.test_section_id
   and tq.test_id is null;

alter table assess.test_question alter column test_id set not null;

alter table assess.test_question drop constraint if exists fk_test_question_test_id;
alter table assess.test_question
  add constraint fk_test_question_test_id foreign key (test_id) references assess.test (test_id);

-- Keeps test_id correct even if test_section_id is ever changed after
-- insert (not a normal flow today, but this makes the denormalization
-- self-maintaining rather than a one-time backfill that can drift).
create or replace function assess.trg_test_question_set_test_id() returns trigger as $$
begin
  select ts.test_id into new.test_id
    from assess.test_section ts
   where ts.test_section_id = new.test_section_id;
  if new.test_id is null then
    raise exception 'assess.test_question: test_section_id % does not resolve to a test_id', new.test_section_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_test_question_set_test_id on assess.test_question;
create trigger trg_test_question_set_test_id
  before insert or update of test_section_id on assess.test_question
  for each row execute function assess.trg_test_question_set_test_id();

alter table assess.test_question drop constraint if exists uq_test_question_test_id_question_id;
alter table assess.test_question
  add constraint uq_test_question_test_id_question_id unique (test_id, question_id);

insert into util.applied_migration (migration_name) values ('027_test_question_cross_section_unique')
on conflict (migration_name) do nothing;
