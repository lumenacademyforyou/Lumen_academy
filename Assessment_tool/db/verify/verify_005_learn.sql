-- verify_005_learn.sql
-- Asserts every table and constraint created by db/migrations/005_learn.sql
-- exists. A migration is not done until this passes (CLAUDE.md migration rule 3).

do $$
declare
  missing text[] := array[]::text[];
  t text;
  c text;
begin
  foreach t in array array[
    'study_plan', 'plan_task', 'study_session', 'topic_mastery', 'flashcard',
    'flashcard_review', 'error_log', 'notification', 'audit_log'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'learn' and table_name = t
    ) then
      missing := array_append(missing, 'table:learn.' || t);
    end if;
  end loop;

  foreach c in array array[
    'study_plan_pkey', 'fk_study_plan_user_id', 'fk_study_plan_cycle_id',
    'plan_task_pkey', 'fk_plan_task_plan_id', 'fk_plan_task_node_id',
    'study_session_pkey', 'fk_study_session_task_id', 'fk_study_session_user_id',
    'topic_mastery_pkey', 'fk_topic_mastery_user_id', 'fk_topic_mastery_node_id', 'uq_topic_mastery_user_id_node_id',
    'flashcard_pkey', 'fk_flashcard_user_id', 'fk_flashcard_node_id', 'fk_flashcard_question_id',
    'flashcard_review_pkey', 'fk_flashcard_review_flashcard_id',
    'error_log_pkey', 'fk_error_log_user_id', 'fk_error_log_response_id', 'fk_error_log_node_id',
    'notification_pkey', 'fk_notification_user_id',
    'audit_log_pkey', 'fk_audit_log_actor_user_id'
  ] loop
    if not exists (
      select 1 from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where n.nspname = 'learn' and con.conname = c
    ) then
      missing := array_append(missing, 'constraint:learn.' || c);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'verify_005_learn FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_005_learn: OK — 9 tables, 27 constraints present';
end $$;
