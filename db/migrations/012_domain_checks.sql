-- 012_domain_checks.sql
-- LA-CC-DB-001 Stage 5. Closes C-04 (35 free-text enum-like columns with
-- zero domain enforcement). Every distinct value below was surveyed live
-- before writing this file (see conversation) — every CHECK's vocabulary
-- includes whatever real value(s) already exist, so nothing here can fail
-- against live data. Columns already constrained by 009/010/011
-- (test_status, test_mode, asset_type, question.question_type,
-- question.lifecycle_status, app_user.user_role) are skipped per the
-- brief's own instruction.
--
-- attempt_event.event_type is left unconstrained, same reasoning as the
-- brief's own model_name exception: it's open client-reported telemetry
-- (focus_lost/focus_regained today, more will be added as the frontend
-- grows what it reports) and constraining it would require a migration
-- every time a new client event is added.

alter table assess.attempt add constraint ck_attempt_sync_state
  check (sync_state is null or sync_state in ('pending','synced','conflict'));
alter table assess.attempt add constraint ck_attempt_state
  check (attempt_state in ('in_progress','submitted','scored','abandoned'));

alter table assess.attempt_response add constraint ck_attempt_response_state
  check (response_state in ('not_visited','answered','skipped','marked_for_review'));

alter table assess.test_assignment add constraint ck_test_assignment_audience
  check (audience_type is null or audience_type in ('individual','batch','institution'));
alter table assess.test_assignment add constraint ck_test_assignment_status
  check (assignment_status in ('assigned','in_progress','completed','expired'));

alter table catalog.exam_cycle add constraint ck_exam_cycle_status
  check (cycle_status in ('upcoming','active','standing','completed','archived'));
alter table catalog.syllabus_node add constraint ck_syllabus_node_type
  check (node_type in ('subject','domain','unit','chapter','topic','subtopic'));
alter table catalog.syllabus_version add constraint ck_syllabus_version_status
  check (version_status in ('draft','active','retired'));

alter table content.ai_generation_job add constraint ck_ai_generation_job_status
  check (job_status in ('queued','running','completed','failed'));
alter table content.ai_generation_job add constraint ck_ai_generation_job_type
  check (job_type in ('manual_import','question_generation','translation','review_assist','other'));
alter table content.question_review add constraint ck_question_review_reviewer_type
  check (reviewer_type is null or reviewer_type in ('human','ai'));
alter table content.question_translation add constraint ck_question_translation_review_status
  check (review_status in ('unreviewed','approved','needs_revision'));
alter table content.source_document add constraint ck_source_document_ingest_status
  check (ingest_status in ('pending','processing','ingested','failed'));
alter table content.source_document add constraint ck_source_document_type
  check (document_type is null or document_type in ('textbook','reference','pyq_paper','notes'));

alter table core.app_user add constraint ck_app_user_status
  check (status in ('active','suspended','deleted'));
alter table core.batch_member add constraint ck_batch_member_status
  check (member_status in ('active','removed'));
alter table core.enrollment add constraint ck_enrollment_status
  check (enrollment_status in ('active','completed','cancelled'));
alter table core.institution add constraint ck_institution_status
  check (status in ('active','suspended'));
alter table core.institution add constraint ck_institution_type
  check (institution_type is null or institution_type in ('school','coaching_center','platform'));
alter table core.student_profile add constraint ck_student_profile_onboarding
  check (onboarding_state in ('not_started','in_progress','completed'));
alter table core.subscription add constraint ck_subscription_status
  check (subscription_status in ('active','expired','cancelled'));

alter table learn.audit_log add constraint ck_audit_log_actor_type
  check (actor_type is null or actor_type in ('user','system'));
alter table learn.error_log add constraint ck_error_log_type
  check (error_type in ('conceptual','careless','time_pressure','guessed'));
alter table learn.flashcard add constraint ck_flashcard_card_type
  check (card_type is null or card_type in ('auto_generated','manual'));
alter table learn.plan_task add constraint ck_plan_task_activity_type
  check (activity_type is null or activity_type in ('read','practice','video','revision','mock_test'));
alter table learn.plan_task add constraint ck_plan_task_status
  check (task_status in ('pending','in_progress','completed','skipped'));
alter table learn.study_plan add constraint ck_study_plan_status
  check (plan_status in ('active','completed','abandoned'));
