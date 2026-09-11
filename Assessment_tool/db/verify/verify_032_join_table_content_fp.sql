-- verify_032_join_table_content_fp.sql

do $$
declare
  v_null_tq int;
  v_null_aq int;
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'assess' and table_name = 'test_question' and column_name = 'content_fp'
  ) then
    raise exception 'verify_032 FAILED — assess.test_question.content_fp column missing';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'assess' and table_name = 'attempt_question' and column_name = 'content_fp'
  ) then
    raise exception 'verify_032 FAILED — assess.attempt_question.content_fp column missing';
  end if;

  select count(*) into v_null_tq from assess.test_question where content_fp is null;
  if v_null_tq > 0 then
    raise exception 'verify_032 FAILED — % assess.test_question rows have a null content_fp', v_null_tq;
  end if;

  select count(*) into v_null_aq from assess.attempt_question where content_fp is null;
  if v_null_aq > 0 then
    raise exception 'verify_032 FAILED — % assess.attempt_question rows have a null content_fp', v_null_aq;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'uq_test_question_test_content'
  ) then
    raise exception 'verify_032 FAILED — missing constraint uq_test_question_test_content';
  end if;

  -- Deliberately NOT checked: a UNIQUE constraint on attempt_question
  -- (attempt_id, content_fp). See migration 032's header comment — 128 real
  -- historical attempts already violate it, and the decision (with the
  -- user) was to leave that history alone rather than force it through.

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_test_question_set_content_fp'
  ) then
    raise exception 'verify_032 FAILED — missing trigger trg_test_question_set_content_fp';
  end if;

  if not exists (
    select 1 from pg_trigger where tgname = 'trg_attempt_question_set_content_fp'
  ) then
    raise exception 'verify_032 FAILED — missing trigger trg_attempt_question_set_content_fp';
  end if;

  raise notice 'verify_032_join_table_content_fp: OK';
end $$;
