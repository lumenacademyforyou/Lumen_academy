-- verify_027_test_question_cross_section_unique.sql

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'assess' and table_name = 'test_question' and column_name = 'test_id'
  ) then
    raise exception 'verify_027 FAILED — assess.test_question.test_id column missing';
  end if;

  if exists (
    select 1 from assess.test_question where test_id is null
  ) then
    raise exception 'verify_027 FAILED — assess.test_question has rows with a null test_id';
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'uq_test_question_test_id_question_id'
  ) then
    raise exception 'verify_027 FAILED — missing constraint uq_test_question_test_id_question_id';
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_test_question_set_test_id'
  ) then
    raise exception 'verify_027 FAILED — missing trigger trg_test_question_set_test_id';
  end if;

  raise notice 'verify_027_test_question_cross_section_unique: OK';
end $$;
