-- 020_attempt_question.sql
-- TE-P4 — attempt-scoped served-question table (gap surfaced in TE-P3,
-- docs/BUILD_LOG.md's TE-P3 entry). assess.test_question is scoped to the
-- whole test, so it can only ever represent FIXED-mode's "every student
-- sees the same paper". BLUEPRINT mode assembles a different paper per
-- attempt (D-1) and had nowhere to persist that. This table is the
-- attempt's own record of what it was served, in what order, with what
-- option order — used by both modes so attempt-runtime code (TE-P4) never
-- has to branch on assembly_mode to know what to read.
--
-- marks/negative_marks are snapshotted at serve time (from
-- catalog.v_section_marking's resolved scheme) rather than re-resolved at
-- scoring time — so a mid-cycle marking-scheme correction never silently
-- changes an already-served attempt's marks out from under it.

create table if not exists assess.attempt_question (
    attempt_id       uuid        not null references assess.attempt(attempt_id) on delete cascade,
    question_id      uuid        not null references content.question(question_id),
    test_section_id  uuid        not null references assess.test_section(test_section_id) on delete cascade,
    sequence_no      smallint    not null,
    option_order     jsonb,
    marks            numeric     not null,
    negative_marks   numeric     not null,
    primary key (attempt_id, question_id)
);
create unique index if not exists ux_attempt_question_section_seq
    on assess.attempt_question (attempt_id, test_section_id, sequence_no);
create index if not exists ix_attempt_question_attempt on assess.attempt_question (attempt_id);

-- assess.attempt_response gains a direct question_id so a BLUEPRINT-mode
-- response (no shared test_question row to reference) has something to key
-- off. test_question_id becomes nullable — populated for FIXED-mode
-- responses, null for BLUEPRINT-mode ones. 0 rows live (docs/DB_STATE.md
-- §5), so no backfill is needed; the NOT NULL is added directly.
alter table assess.attempt_response
    add column if not exists question_id uuid references content.question(question_id);
alter table assess.attempt_response alter column question_id set not null;
alter table assess.attempt_response alter column test_question_id drop not null;

-- Rewritten to validate through assess.attempt_question when test_question_id
-- is null (BLUEPRINT mode), and to attach a custom SQLSTATE (LM001) so the
-- application layer can map a mismatched option_id to the brief's catalogued
-- RESPONSE_OPTION_MISMATCH (422) instead of an unhandled 500 — closing
-- defect (a)'s error-handling gap confirmed in docs/ENGINE_STATE.md §3(a).
create or replace function assess.trg_attempt_response_option_guard()
returns trigger
language plpgsql
as $function$
declare
  v_question_id uuid;
  v_option_qid uuid;
  v_response_test_id uuid;
  v_owning_test_id uuid;
begin
  if new.test_question_id is not null then
    select q.question_id, ts.test_id into v_question_id, v_owning_test_id
      from assess.test_question tq
      join assess.test_section ts on ts.test_section_id = tq.test_section_id
      join content.question q on q.question_id = tq.question_id
     where tq.test_question_id = new.test_question_id;

    if v_question_id is null then
      raise exception 'attempt_response: test_question_id % does not resolve to a question', new.test_question_id
        using errcode = 'LM001';
    end if;
    if v_question_id is distinct from new.question_id then
      raise exception 'attempt_response: question_id % does not match the question behind test_question_id % (question %)',
        new.question_id, new.test_question_id, v_question_id
        using errcode = 'LM001';
    end if;
  else
    select aq.question_id, a.test_id into v_question_id, v_owning_test_id
      from assess.attempt_question aq
      join assess.attempt a on a.attempt_id = aq.attempt_id
     where aq.attempt_id = new.attempt_id and aq.question_id = new.question_id;

    if v_question_id is null then
      raise exception 'attempt_response: question_id % was not served in attempt % (no test_question_id, and no matching assess.attempt_question row)',
        new.question_id, new.attempt_id
        using errcode = 'LM001';
    end if;
  end if;

  select test_id into v_response_test_id from assess.attempt where attempt_id = new.attempt_id;
  if v_response_test_id is distinct from v_owning_test_id then
    raise exception 'attempt_response: question % does not belong to attempt %''s test', new.question_id, new.attempt_id
      using errcode = 'LM001';
  end if;

  if new.option_id is not null then
    select question_id into v_option_qid from content.question_option where option_id = new.option_id;
    if v_option_qid is distinct from v_question_id then
      raise exception 'attempt_response: option_id % belongs to question %, not question % served in this attempt',
        new.option_id, v_option_qid, v_question_id
        using errcode = 'LM001';
    end if;
  end if;

  return new;
end;
$function$;

insert into util.applied_migration (migration_name) values ('020_attempt_question')
on conflict (migration_name) do nothing;
