-- verify_004_assess.sql
-- Asserts every table and constraint created by db/migrations/004_assess.sql
-- exists. A migration is not done until this passes (CLAUDE.md migration rule 3).

do $$
declare
  missing text[] := array[]::text[];
  t text;
  c text;
begin
  foreach t in array array[
    'test', 'test_section', 'test_question', 'test_assignment', 'attempt',
    'attempt_response', 'attempt_event', 'scorecard', 'section_score'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'assess' and table_name = t
    ) then
      missing := array_append(missing, 'table:assess.' || t);
    end if;
  end loop;

  foreach c in array array[
    'test_pkey', 'fk_test_pattern_id', 'fk_test_cycle_id', 'fk_test_created_by', 'uq_test_test_code',
    'test_section_pkey', 'fk_test_section_test_id', 'fk_test_section_pattern_section_id', 'uq_test_section_test_id_sequence_no',
    'test_question_pkey', 'fk_test_question_test_section_id', 'fk_test_question_question_id', 'uq_test_question_test_section_id_sequence_no',
    'test_assignment_pkey', 'fk_test_assignment_test_id', 'fk_test_assignment_user_id', 'fk_test_assignment_batch_id',
    'attempt_pkey', 'fk_attempt_test_id', 'fk_attempt_user_id', 'fk_attempt_assignment_id', 'uq_attempt_test_id_user_id_attempt_no',
    'attempt_response_pkey', 'fk_attempt_response_attempt_id', 'fk_attempt_response_test_question_id', 'fk_attempt_response_option_id', 'uq_attempt_response_attempt_id_test_question_id',
    'attempt_event_pkey', 'fk_attempt_event_attempt_id',
    'scorecard_pkey', 'fk_scorecard_attempt_id', 'uq_scorecard_attempt_id',
    'section_score_pkey', 'fk_section_score_scorecard_id', 'fk_section_score_test_section_id', 'uq_section_score_scorecard_id_test_section_id'
  ] loop
    if not exists (
      select 1 from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where n.nspname = 'assess' and con.conname = c
    ) then
      missing := array_append(missing, 'constraint:assess.' || c);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'verify_004_assess FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_004_assess: OK — 9 tables, 36 constraints present';
end $$;
