-- verify_026_learn_study_tools.sql

do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'learn' and table_name = 'study_plan' and column_name = 'updated_at'
  ) then
    raise exception 'verify_026 FAILED — missing column: learn.study_plan.updated_at';
  end if;

  if not exists (
    select 1 from pg_indexes
     where schemaname = 'learn' and indexname = 'uq_study_plan_one_active_per_user'
  ) then
    raise exception 'verify_026 FAILED — missing index: uq_study_plan_one_active_per_user';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'learn' and table_name = 'study_plan_goal'
  ) then
    raise exception 'verify_026 FAILED — missing table: learn.study_plan_goal';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'learn' and table_name = 'custom_task'
  ) then
    raise exception 'verify_026 FAILED — missing table: learn.custom_task';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'learn' and table_name = 'revision_note'
  ) then
    raise exception 'verify_026 FAILED — missing table: learn.revision_note';
  end if;

  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'learn' and table_name = 'pomodoro_session'
  ) then
    raise exception 'verify_026 FAILED — missing table: learn.pomodoro_session';
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'learn' and table_name = 'pomodoro_session' and column_name = 'session_type'
  ) then
    raise exception 'verify_026 FAILED — missing column: learn.pomodoro_session.session_type';
  end if;

  raise notice 'verify_026_learn_study_tools: OK';
end $$;
