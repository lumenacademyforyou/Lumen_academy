-- verify_012_domain_checks.sql

do $$
declare
  missing text[] := array[]::text[];
  expected text[] := array[
    'ck_attempt_sync_state','ck_attempt_state','ck_attempt_response_state',
    'ck_test_assignment_audience','ck_test_assignment_status',
    'ck_exam_cycle_status','ck_syllabus_node_type','ck_syllabus_version_status',
    'ck_ai_generation_job_status','ck_ai_generation_job_type',
    'ck_question_review_reviewer_type','ck_question_translation_review_status',
    'ck_source_document_ingest_status','ck_source_document_type',
    'ck_app_user_status','ck_batch_member_status','ck_enrollment_status',
    'ck_institution_status','ck_institution_type','ck_student_profile_onboarding',
    'ck_subscription_status','ck_audit_log_actor_type','ck_error_log_type',
    'ck_flashcard_card_type','ck_plan_task_activity_type','ck_plan_task_status',
    'ck_study_plan_status'
  ];
  c text;
begin
  foreach c in array expected loop
    if not exists (select 1 from pg_constraint con where con.conname = c) then
      missing := array_append(missing, 'constraint:' || c);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'verify_012_domain_checks FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_012_domain_checks: OK — all % CHECK constraints present', array_length(expected, 1);
end $$;

-- After-survey: same columns as the before-survey run prior to writing this
-- migration (see conversation) — confirms every live value still passes
-- its new CHECK (if any didn't, the ALTER TABLE ADD CONSTRAINT above would
-- already have failed the whole migration, so this is a redundant but
-- explicit confirmation per the brief's "print the before/after survey").
do $$
begin
  raise notice 'after-survey: attempt.attempt_state = %', (select string_agg(distinct attempt_state, ',') from assess.attempt);
  raise notice 'after-survey: attempt_response.response_state = %', (select string_agg(distinct response_state, ',') from assess.attempt_response);
  raise notice 'after-survey: exam_cycle.cycle_status = %', (select string_agg(distinct cycle_status, ',') from catalog.exam_cycle);
  raise notice 'after-survey: syllabus_node.node_type = %', (select string_agg(distinct node_type, ',') from catalog.syllabus_node);
  raise notice 'after-survey: app_user.status = %', (select string_agg(distinct status, ',') from core.app_user);
  raise notice 'after-survey: student_profile.onboarding_state = %', (select string_agg(distinct onboarding_state, ',') from core.student_profile);
end $$;

-- Functional proof: a representative sample (one per schema) rejects an
-- invalid value. Not all 26 — the pattern is identical for each. Rolls
-- back via its own exception handler.
do $$
declare
  v_attempt_id uuid;
  v_rejected boolean;
begin
  select attempt_id into v_attempt_id from assess.attempt limit 1;

  begin
    update assess.attempt set attempt_state = 'not_a_real_state' where attempt_id = v_attempt_id;
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_012: an invalid assess.attempt.attempt_state value was NOT rejected';
  end if;

  begin
    update catalog.syllabus_node set node_type = 'not_a_real_type' where node_id = (select node_id from catalog.syllabus_node limit 1);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_012: an invalid catalog.syllabus_node.node_type value was NOT rejected';
  end if;

  begin
    update core.app_user set status = 'not_a_real_status' where user_id = (select user_id from core.app_user limit 1);
    v_rejected := false;
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'verify_012: an invalid core.app_user.status value was NOT rejected';
  end if;

  raise notice 'verify_012_domain_checks: functional proof OK — invalid values rejected in assess/catalog/core samples';
  raise exception 'verify_012_domain_checks: proof complete, rolling back (no real rows touched)';
exception when others then
  if sqlerrm like 'verify_012_domain_checks: proof complete%' then
    raise notice '%', sqlerrm;
  else
    raise;
  end if;
end $$;
