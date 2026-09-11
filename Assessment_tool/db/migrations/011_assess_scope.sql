-- 011_assess_scope.sql
-- LA-CC-DB-001 Stage 4. Closes S-01 (test cannot express scope), S-02
-- (pattern_id/cycle_id force every ad-hoc test into an official cycle),
-- S-09 (question versioning not pinned into papers), C-01 (attempt_response
-- option_id not verified against its question), C-02 (no
-- UNIQUE(test_section_id, question_id)).
--
-- Survey run before this file (see conversation): assess.test has 1 row
-- (test_mode='practice', test_status='published' — both fit the CHECK
-- vocabulary below with no changes needed). assess.test_question has zero
-- (test_section_id, question_id) duplicates — the new unique constraint
-- applies with no cleanup needed. assess.attempt_response currently has
-- zero rows where option_id's owning question differs from
-- test_question_id's question (23 real responses, all consistent) — the
-- new guard trigger applies with no existing violations, though this was a
-- live, exploitable gap until now (see B-02 in the defect register).

alter table assess.test add column exam_id             uuid;
alter table assess.test add column scope_type          text not null default 'custom';
alter table assess.test add column source_type         text not null default 'authored';
alter table assess.test add column source_cycle_id     uuid references catalog.exam_cycle(cycle_id) on delete restrict;
alter table assess.test add column syllabus_version_id uuid references catalog.syllabus_version(syllabus_version_id) on delete restrict;
alter table assess.test add column language_code       text not null default 'en';
alter table assess.test add column is_public           boolean not null default false;
alter table assess.test add column generation_seed     bigint;

alter table assess.test add constraint fk_test_exam_id
  foreign key (exam_id) references catalog.exam(exam_id) on delete restrict;
alter table assess.test add constraint ck_test_scope_type
  check (scope_type in ('full','subject','unit','chapter','topic','custom','pyq'));
alter table assess.test add constraint ck_test_source_type
  check (source_type in ('authored','pyq','generated'));
alter table assess.test add constraint ck_test_status
  check (test_status in ('draft','ready','published','archived'));
alter table assess.test add constraint ck_test_mode
  check (test_mode in ('practice','timed','exam','diagnostic'));
alter table assess.test add constraint ck_test_pyq_cycle
  check (scope_type <> 'pyq' or source_cycle_id is not null);

-- S-02: cycle_id was NOT NULL, forcing every ad-hoc practice/custom test to
-- claim an official exam cycle. Nullable now; 014_seed_pilot.sql seeds a
-- standing PRACTICE cycle+pattern per exam so ad-hoc tests still resolve a
-- marking scheme through pattern_id (which stays NOT NULL).
alter table assess.test alter column cycle_id drop not null;

-- Backfill the one live test row's exam_id from its existing cycle_id, so
-- the new NOT-NULL-in-spirit column isn't silently null for real data
-- (kept nullable at the constraint level since a fully ad-hoc/custom test
-- generated across nodes from multiple exams is conceivable later — see
-- B-01's generator, which always sets this explicitly per request anyway).
update assess.test t
   set exam_id = ec.exam_id
  from catalog.exam_cycle ec
 where ec.cycle_id = t.cycle_id
   and t.exam_id is null;

create table assess.test_scope_node (
  test_id uuid not null references assess.test(test_id)           on delete cascade,
  node_id uuid not null references catalog.syllabus_node(node_id) on delete restrict,
  constraint pk_test_scope_node primary key (test_id, node_id)
);

-- C-02: only positional uniqueness existed (test_section_id, sequence_no),
-- so the same question could appear twice in one section. Zero live
-- violators (surveyed above).
alter table assess.test_question add constraint uq_test_question_section_question
  unique (test_section_id, question_id);
alter table assess.test_question add column question_revision integer;

-- Stamp question_revision from the live content.question.revision_no
-- (added in 010) at the moment a question is placed into a test, so a
-- later edit to the question doesn't retroactively change what a past
-- paper's answer key was (S-09).
create or replace function assess.trg_test_question_revision() returns trigger as $$
begin
  if new.question_revision is null then
    select revision_no into new.question_revision from content.question where question_id = new.question_id;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_test_question_revision
  before insert on assess.test_question
  for each row execute function assess.trg_test_question_revision();

-- Backfill question_revision for the 20 live test_question rows from the
-- question's current revision_no (all revision_no=1 today per 010's
-- default, so this is a clean, unambiguous backfill).
update assess.test_question tq
   set question_revision = q.revision_no
  from content.question q
 where q.question_id = tq.question_id
   and tq.question_revision is null;

alter table assess.test_question alter column question_revision set not null;

-- C-01: the actual scoring-integrity gap (B-02 in the defect register) —
-- option_id was never verified against the question behind
-- test_question_id, so a response could reference an option belonging to a
-- different question and be scored against it. This is the database-layer
-- backstop; the primary fix belongs in upsertResponse/batchUpsertResponses
-- (Stage 7), but this trigger holds even if a future write path skips the
-- service layer entirely.
create or replace function assess.trg_attempt_response_option_guard() returns trigger as $$
declare
  v_test_question_qid uuid;
  v_option_qid uuid;
  v_response_test_id uuid;
  v_tq_test_id uuid;
begin
  select q.question_id, ts.test_id into v_test_question_qid, v_tq_test_id
    from assess.test_question tq
    join assess.test_section ts on ts.test_section_id = tq.test_section_id
    join content.question q on q.question_id = tq.question_id
   where tq.test_question_id = new.test_question_id;

  if v_test_question_qid is null then
    raise exception 'attempt_response: test_question_id % does not resolve to a question', new.test_question_id;
  end if;

  select test_id into v_response_test_id from assess.attempt where attempt_id = new.attempt_id;
  if v_response_test_id is distinct from v_tq_test_id then
    raise exception 'attempt_response: test_question_id % does not belong to attempt %''s test', new.test_question_id, new.attempt_id;
  end if;

  if new.option_id is not null then
    select question_id into v_option_qid from content.question_option where option_id = new.option_id;
    if v_option_qid is distinct from v_test_question_qid then
      raise exception 'attempt_response: option_id % belongs to question %, not the question behind test_question_id % (question %)',
        new.option_id, v_option_qid, new.test_question_id, v_test_question_qid;
    end if;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_attempt_response_option_guard
  before insert or update of option_id, test_question_id on assess.attempt_response
  for each row execute function assess.trg_attempt_response_option_guard();

-- Cross-exam consistency for scoped tests: every node in test_scope_node
-- must belong to the test's syllabus_version_id, and (except for
-- custom/full/pyq scope) its level must match scope_type.
create or replace function assess.trg_test_scope_node_consistency() returns trigger as $$
declare
  v_test assess.test%rowtype;
  v_node catalog.syllabus_node%rowtype;
  v_expected_level smallint;
begin
  select * into v_test from assess.test where test_id = new.test_id;
  select * into v_node from catalog.syllabus_node where node_id = new.node_id;

  if v_test.syllabus_version_id is not null and v_node.syllabus_version_id <> v_test.syllabus_version_id then
    raise exception 'test_scope_node: node % does not belong to test %''s syllabus_version', new.node_id, new.test_id;
  end if;

  v_expected_level := case v_test.scope_type
    when 'subject' then 1 when 'unit' then 2 when 'chapter' then 3 when 'topic' then 4 else null end;
  if v_expected_level is not null and v_node.level_no is not null and v_node.level_no <> v_expected_level then
    raise exception 'test_scope_node: node % is at level %, expected level % for scope_type %',
      new.node_id, v_node.level_no, v_expected_level, v_test.scope_type;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_test_scope_node_consistency
  before insert or update on assess.test_scope_node
  for each row execute function assess.trg_test_scope_node_consistency();
