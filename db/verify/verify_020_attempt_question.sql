-- verify_020_attempt_question.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.tables where table_schema='assess' and table_name='attempt_question') then
    missing := array_append(missing, 'table:assess.attempt_question');
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='assess' and table_name='attempt_response' and column_name='question_id'
  ) then
    missing := array_append(missing, 'column:assess.attempt_response.question_id');
  end if;
  if exists (
    select 1 from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='assess' and c.relname='attempt_response' and a.attname='test_question_id' and a.attnotnull
  ) then
    missing := array_append(missing, 'assess.attempt_response.test_question_id is still NOT NULL (should be nullable for BLUEPRINT-mode responses)');
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname='assess' and indexname='ux_attempt_question_section_seq'
  ) then
    missing := array_append(missing, 'index:ux_attempt_question_section_seq');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_020_attempt_question FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_020_attempt_question: OK — attempt_question table, attempt_response.question_id, nullable test_question_id, index all present';
end $$;

-- Functional proof: builds a minimal FIXED-mode fixture chain and a
-- BLUEPRINT-mode fixture chain (attempt_question row, no test_question),
-- proves the rewritten trigger validates both paths and rejects a
-- mismatched option_id with SQLSTATE LM001, then force-rolls-back.
do $$
declare
  v_user_id      uuid;
  v_pattern_id   uuid;
  v_pattern_section_id uuid;
  v_subject_id   uuid;
  v_node_id      uuid;
  v_job_id       uuid;
  v_question_id  uuid;
  v_other_question_id uuid;
  v_wrong_option_id uuid;
  v_right_option_id uuid;
  v_test_id      uuid;
  v_test_section_id uuid;
  v_test_question_id uuid;
  v_attempt_id   uuid;
begin
  select user_id into v_user_id from core.app_user limit 1;
  select pattern_id into v_pattern_id from catalog.exam_pattern limit 1;
  select pattern_section_id, subject_id into v_pattern_section_id, v_subject_id from catalog.pattern_section limit 1;
  select node_id into v_node_id from catalog.syllabus_node where subject_id = v_subject_id limit 1;

  insert into content.ai_generation_job (requested_by, job_type, job_status) values (v_user_id, 'other', 'completed') returning job_id into v_job_id;

  insert into content.question (question_uid, primary_node_id, job_id, question_type, lifecycle_status, stem_text)
    values ('TE_P4_VERIFY_A_' || gen_random_uuid()::text, v_node_id, v_job_id, 'single_choice', 'published', 'verify_020 fixture A')
    returning question_id into v_question_id;
  insert into content.question_option (question_id, option_label, option_text, is_correct) values (v_question_id, 'A', 'right', true) returning option_id into v_right_option_id;

  insert into content.question (question_uid, primary_node_id, job_id, question_type, lifecycle_status, stem_text)
    values ('TE_P4_VERIFY_B_' || gen_random_uuid()::text, v_node_id, v_job_id, 'single_choice', 'published', 'verify_020 fixture B')
    returning question_id into v_other_question_id;
  insert into content.question_option (question_id, option_label, option_text, is_correct) values (v_other_question_id, 'A', 'other question option', false) returning option_id into v_wrong_option_id;

  insert into assess.test (test_code, pattern_id, created_by, title, test_status, source_type)
    values ('TE_P4_VERIFY_' || gen_random_uuid()::text, v_pattern_id, v_user_id, 'verify_020 fixture test', 'draft', 'authored')
    returning test_id into v_test_id;
  insert into assess.test_section (test_id, pattern_section_id, section_name, sequence_no) values (v_test_id, v_pattern_section_id, 'verify_020 section', 1) returning test_section_id into v_test_section_id;
  insert into assess.test_question (test_section_id, question_id, sequence_no) values (v_test_section_id, v_question_id, 1) returning test_question_id into v_test_question_id;
  insert into assess.attempt (test_id, user_id, attempt_no, attempt_state) values (v_test_id, v_user_id, 999, 'in_progress') returning attempt_id into v_attempt_id;

  -- FIXED-mode path: valid response with a matching option is accepted.
  insert into assess.attempt_response (attempt_id, test_question_id, question_id, option_id, response_state)
    values (v_attempt_id, v_test_question_id, v_question_id, v_right_option_id, 'answered');

  -- FIXED-mode path: a mismatched option is rejected with SQLSTATE LM001.
  begin
    insert into assess.attempt_response (attempt_id, test_question_id, question_id, option_id, response_state)
      values (v_attempt_id, v_test_question_id, v_question_id, v_wrong_option_id, 'answered')
      on conflict (attempt_id, test_question_id) do update set option_id = excluded.option_id;
    raise exception 'verify_020: mismatched option_id was NOT rejected';
  exception
    when sqlstate 'LM001' then null; -- expected
  end;

  -- BLUEPRINT-mode path: a served attempt_question row with no test_question_id.
  insert into assess.attempt_question (attempt_id, question_id, test_section_id, sequence_no, marks, negative_marks)
    values (v_attempt_id, v_other_question_id, v_test_section_id, 1, 4, -1);
  insert into assess.attempt_response (attempt_id, question_id, option_id, response_state)
    values (v_attempt_id, v_other_question_id, v_wrong_option_id, 'answered');

  -- BLUEPRINT-mode path: a question never served in this attempt is rejected.
  begin
    insert into assess.attempt_response (attempt_id, question_id, response_state)
      values (v_attempt_id, gen_random_uuid(), 'answered');
    raise exception 'verify_020: an unserved question_id was NOT rejected';
  exception
    when sqlstate 'LM001' then null; -- expected
  end;

  raise notice 'verify_020_attempt_question: functional proof OK — FIXED-mode and BLUEPRINT-mode paths both validated, mismatched/unserved questions rejected with LM001';
  raise exception 'verify_020_attempt_question: proof complete, rolling back (no real rows touched)';
exception when others then
  if sqlerrm like 'verify_020_attempt_question: proof complete%' then
    raise notice '%', sqlerrm;
  else
    raise;
  end if;
end $$;
