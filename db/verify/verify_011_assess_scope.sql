-- verify_011_assess_scope.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (
    select 1 from information_schema.columns where table_schema='assess' and table_name='test'
      and column_name in ('exam_id','scope_type','source_type','source_cycle_id','syllabus_version_id',
                           'language_code','is_public','generation_seed')
    having count(*) = 8
  ) then
    missing := array_append(missing, 'columns:assess.test scope set');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='assess' and table_name='test_scope_node') then
    missing := array_append(missing, 'table:assess.test_scope_node');
  end if;
  if not exists (
    select 1 from pg_constraint con join pg_namespace n on n.oid=con.connamespace
    where n.nspname='assess' and con.conname='uq_test_question_section_question'
  ) then
    missing := array_append(missing, 'constraint:uq_test_question_section_question');
  end if;
  if exists (
    select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='assess' and c.relname='test' and a.attname='cycle_id' and a.attnotnull
  ) then
    missing := array_append(missing, 'assess.test.cycle_id is still NOT NULL');
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='assess' and c.relname='attempt_response' and t.tgname='trg_attempt_response_option_guard'
  ) then
    missing := array_append(missing, 'trigger:trg_attempt_response_option_guard');
  end if;
  if not exists (
    select 1 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='assess' and c.relname='test_question' and t.tgname='trg_test_question_revision'
  ) then
    missing := array_append(missing, 'trigger:trg_test_question_revision');
  end if;
  if exists (select 1 from assess.test_question where question_revision is null) then
    missing := array_append(missing, 'backfill:some live test_question has null question_revision');
  end if;
  if exists (select 1 from assess.test where exam_id is null) then
    missing := array_append(missing, 'backfill:the live test row has null exam_id');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_011_assess_scope FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_011_assess_scope: OK — test scope columns, test_scope_node, section-question uniqueness, nullable cycle_id, option-guard trigger, revision trigger, backfills all present';
end $$;

-- Functional proof: a mismatched option_id is rejected by trigger, and a
-- duplicate question in a section is rejected. Uses real, already-existing
-- attempt/test_question/option rows (no new fixtures needed) and never
-- commits — rolls back via its own exception handler.
do $$
declare
  v_attempt_id uuid;
  v_test_id uuid;
  v_test_question_id uuid;
  v_question_id uuid;
  v_test_section_id uuid;
  v_wrong_option_id uuid;
  v_rejected boolean;
begin
  select test_id into v_test_id from assess.test limit 1;
  select a.attempt_id into v_attempt_id from assess.attempt a where a.test_id = v_test_id limit 1;
  select tq.test_question_id, tq.question_id, tq.test_section_id
    into v_test_question_id, v_question_id, v_test_section_id
    from assess.test_question tq join assess.test_section ts on ts.test_section_id = tq.test_section_id
   where ts.test_id = v_test_id limit 1;
  select option_id into v_wrong_option_id from content.question_option where question_id <> v_question_id limit 1;

  begin
    insert into assess.attempt_response (attempt_id, test_question_id, option_id, response_state)
      values (v_attempt_id, v_test_question_id, v_wrong_option_id, 'answered')
      on conflict (attempt_id, test_question_id) do update set option_id = excluded.option_id;
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_011: a mismatched option_id (wrong question) was NOT rejected';
  end if;

  begin
    insert into assess.test_question (test_section_id, question_id, sequence_no, is_optional)
      values (v_test_section_id, v_question_id, 9999, false);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_011: a duplicate question in the same section was NOT rejected';
  end if;

  raise notice 'verify_011_assess_scope: functional proof OK — mismatched option_id rejected, duplicate question-in-section rejected';
  raise exception 'verify_011_assess_scope: proof complete, rolling back (no real rows touched)';
exception when others then
  if sqlerrm like 'verify_011_assess_scope: proof complete%' then
    raise notice '%', sqlerrm;
  else
    raise;
  end if;
end $$;
