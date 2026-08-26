-- verify_018_test_engine.sql

do $$
declare
  missing text[] := array[]::text[];
begin
  if not exists (select 1 from information_schema.tables where table_schema='util' and table_name='applied_migration') then
    missing := array_append(missing, 'table:util.applied_migration');
  end if;
  if (select count(*) from util.applied_migration) < 18 then
    missing := array_append(missing, 'backfill:util.applied_migration has fewer than 18 rows');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='assess' and table_name='user_question_seen') then
    missing := array_append(missing, 'table:assess.user_question_seen');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='assess' and table_name='attempt_pause') then
    missing := array_append(missing, 'table:assess.attempt_pause');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='assess' and table_name='idempotency_key') then
    missing := array_append(missing, 'table:assess.idempotency_key');
  end if;
  if not exists (select 1 from information_schema.tables where table_schema='assess' and table_name='test_blueprint') then
    missing := array_append(missing, 'table:assess.test_blueprint');
  end if;
  if not exists (
    select 1 from information_schema.columns where table_schema='assess' and table_name='attempt'
      and column_name in ('paused_ms_total','attempt_seq','submitted_reason')
    having count(*) = 3
  ) then
    missing := array_append(missing, 'columns:assess.attempt paused_ms_total/attempt_seq/submitted_reason');
  end if;
  if not exists (
    select 1 from pg_constraint con join pg_namespace n on n.oid=con.connamespace
    where n.nspname='assess' and con.conname='ck_attempt_state'
      and pg_get_constraintdef(con.oid) like '%''paused''%'
  ) then
    missing := array_append(missing, 'constraint:ck_attempt_state does not allow paused');
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname='assess' and indexname='ux_attempt_pause_one_open'
  ) then
    missing := array_append(missing, 'index:ux_attempt_pause_one_open');
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname='assess' and indexname='ix_user_question_seen_user_seq'
  ) then
    missing := array_append(missing, 'index:ix_user_question_seen_user_seq');
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname='assess' and indexname='ix_attempt_user_started'
  ) then
    missing := array_append(missing, 'index:ix_attempt_user_started');
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname='content' and indexname='ix_question_node_map_node'
  ) then
    missing := array_append(missing, 'index:ix_question_node_map_node');
  end if;
  if not exists (
    select 1 from pg_indexes where schemaname='content' and indexname='ix_question_lifecycle_published'
  ) then
    missing := array_append(missing, 'index:ix_question_lifecycle_published');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_018_test_engine FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_018_test_engine: OK — ledger table, four new assess tables, attempt columns, widened ck_attempt_state, and all five new indexes present';
end $$;

-- Functional proof: builds a minimal fixture chain (ai_generation_job ->
-- question -> test -> test_section -> attempt) reusing existing catalog/core
-- rows where they already exist, exercises every new constraint's
-- reject-the-bad-value path, then force-rolls-back via its own exception
-- handler so nothing is left live. Same pattern as verify_011_assess_scope.sql.
do $$
declare
  v_user_id           uuid;
  v_pattern_id         uuid;
  v_pattern_section_id uuid;
  v_subject_id         uuid;
  v_node_id            uuid;
  v_job_id             uuid;
  v_question_id        uuid;
  v_test_id            uuid;
  v_test_section_id    uuid;
  v_attempt_id         uuid;
  v_rejected           boolean;
begin
  select user_id into v_user_id from core.app_user limit 1;
  select pattern_id into v_pattern_id from catalog.exam_pattern limit 1;
  select pattern_section_id, subject_id into v_pattern_section_id, v_subject_id from catalog.pattern_section limit 1;
  select node_id into v_node_id from catalog.syllabus_node limit 1;

  if v_user_id is null or v_pattern_id is null or v_pattern_section_id is null or v_node_id is null then
    raise exception 'verify_018: prerequisite fixture data missing (core.app_user / catalog.exam_pattern / catalog.pattern_section / catalog.syllabus_node) — cannot build a fixture chain';
  end if;

  insert into content.ai_generation_job (requested_by, job_type, job_status)
    values (v_user_id, 'other', 'completed')
    returning job_id into v_job_id;

  insert into content.question (question_uid, primary_node_id, job_id, lifecycle_status, stem_text)
    values ('TE_P1_VERIFY_' || gen_random_uuid()::text, v_node_id, v_job_id, 'published', 'verify_018 fixture question')
    returning question_id into v_question_id;

  insert into assess.test (test_code, pattern_id, created_by, title, test_status, source_type)
    values ('TE_P1_VERIFY_' || gen_random_uuid()::text, v_pattern_id, v_user_id, 'verify_018 fixture test', 'draft', 'generated')
    returning test_id into v_test_id;

  insert into assess.test_section (test_id, pattern_section_id, section_name, sequence_no)
    values (v_test_id, v_pattern_section_id, 'verify_018 fixture section', 1)
    returning test_section_id into v_test_section_id;

  insert into assess.attempt (test_id, user_id, attempt_no, attempt_state)
    values (v_test_id, v_user_id, 999, 'in_progress')
    returning attempt_id into v_attempt_id;

  -- assess.user_question_seen.times_seen must be > 0
  begin
    insert into assess.user_question_seen (user_id, question_id, times_seen, last_seen_attempt_seq)
      values (v_user_id, v_question_id, 0, 1);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_018: times_seen = 0 was NOT rejected';
  end if;

  -- assess.attempt_pause: one open pause is fine, a second concurrent one is not
  insert into assess.attempt_pause (attempt_id) values (v_attempt_id);
  begin
    insert into assess.attempt_pause (attempt_id) values (v_attempt_id);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_018: a second concurrent open pause on the same attempt was NOT rejected';
  end if;

  -- ck_attempt_pause_order: resumed_at before paused_at is invalid
  begin
    insert into assess.attempt_pause (attempt_id, paused_at, resumed_at)
      values (v_attempt_id, now(), now() - interval '1 minute');
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_018: resumed_at before paused_at was NOT rejected';
  end if;

  -- assess.idempotency_key.operation must be one of the two allowed values
  begin
    insert into assess.idempotency_key (key, user_id, operation, response_body)
      values ('verify-018-' || gen_random_uuid()::text, v_user_id, 'not_a_real_operation', '{}'::jsonb);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_018: an invalid idempotency operation was NOT rejected';
  end if;

  -- assess.test_blueprint.pick_count must be > 0
  begin
    insert into assess.test_blueprint (test_id, test_section_id, subject_id, pick_count)
      values (v_test_id, v_test_section_id, v_subject_id, 0);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_018: test_blueprint.pick_count = 0 was NOT rejected';
  end if;

  -- assess.test_blueprint.question_format must be one of content.question's own type values
  begin
    insert into assess.test_blueprint (test_id, test_section_id, subject_id, pick_count, question_format)
      values (v_test_id, v_test_section_id, v_subject_id, 10, 'not_a_real_format');
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_018: test_blueprint.question_format with a bogus value was NOT rejected';
  end if;

  -- a valid test_blueprint row is accepted
  insert into assess.test_blueprint (test_id, test_section_id, subject_id, syllabus_node_id, pick_count, question_format)
    values (v_test_id, v_test_section_id, v_subject_id, v_node_id, 10, 'single_choice');

  -- widened ck_attempt_state now accepts 'paused' ...
  update assess.attempt set attempt_state = 'paused' where attempt_id = v_attempt_id;

  -- ... but still rejects a value outside the (now five-member) allow-list
  begin
    update assess.attempt set attempt_state = 'not_a_real_state' where attempt_id = v_attempt_id;
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_018: an invalid attempt_state was NOT rejected after widening ck_attempt_state';
  end if;

  -- submitted_reason accepts a valid value and rejects an invalid one
  update assess.attempt set attempt_state = 'submitted', submitted_reason = 'expiry' where attempt_id = v_attempt_id;
  begin
    update assess.attempt set submitted_reason = 'not_a_real_reason' where attempt_id = v_attempt_id;
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_018: an invalid submitted_reason was NOT rejected';
  end if;

  raise notice 'verify_018_test_engine: functional proof OK — times_seen, one-open-pause, pause-order, idempotency-operation, blueprint pick_count, blueprint question_format, widened attempt_state, and submitted_reason all reject their bad values and accept their good ones';
  raise exception 'verify_018_test_engine: proof complete, rolling back (no real rows touched)';
exception when others then
  if sqlerrm like 'verify_018_test_engine: proof complete%' then
    raise notice '%', sqlerrm;
  else
    raise;
  end if;
end $$;
