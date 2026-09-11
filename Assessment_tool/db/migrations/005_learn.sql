-- 005_learn.sql
-- Lumen Academy — learn schema: 9 relations. Final schema in migration order
-- (catalog -> core -> content -> assess -> learn).
--
-- Sources: docs/db/SCHEMA_SPEC.md (keys, FK edge list),
-- docs/design/03_conceptual_er_low_level_revA.md (descriptive attribute names
-- — all 9 tables here match their stated "+N" counts exactly, no gaps like
-- earlier schemas had).
-- Depends on: 001_catalog.sql, 002_core.sql, 003_content.sql, 004_assess.sql.
--
-- Nullable FKs, judgment calls (plain/unannotated in SCHEMA_SPEC, made
-- nullable based on a documented discriminator column rather than left NOT
-- NULL by default):
--   flashcard.node_id / question_id — "created_from" exists specifically to
--     record a card's origin, implying not every card is auto-derived from a
--     question+node pair; user-authored cards would have neither.
--   audit_log.actor_user_id — "actor_type" exists as a separate discriminator
--     (student/educator/admin/system); a system-triggered action has no
--     app_user row to point at.

-- --------------------------------------------------------------------- learn.study_plan
create table if not exists learn.study_plan (
  plan_id             uuid primary key default gen_random_uuid(),
  user_id             uuid not null,
  cycle_id            uuid not null,
  plan_title          text not null,
  target_exam_date    date,
  daily_minutes       smallint,
  start_date          date,
  plan_strategy       text,
  plan_status         text not null,
  constraint fk_study_plan_user_id foreign key (user_id) references core.app_user (user_id),
  constraint fk_study_plan_cycle_id foreign key (cycle_id) references catalog.exam_cycle (cycle_id)
);

-- ---------------------------------------------------------------------- learn.plan_task
create table if not exists learn.plan_task (
  task_id            uuid primary key default gen_random_uuid(),
  plan_id            uuid not null,
  node_id            uuid not null,
  scheduled_date     date,
  activity_type      text,
  planned_minutes    smallint,
  task_status        text not null,
  completed_at       timestamptz,
  constraint fk_plan_task_plan_id foreign key (plan_id) references learn.study_plan (plan_id),
  constraint fk_plan_task_node_id foreign key (node_id) references catalog.syllabus_node (node_id)
);

-- ------------------------------------------------------------------- learn.study_session
create table if not exists learn.study_session (
  session_id        uuid primary key default gen_random_uuid(),
  task_id           uuid not null,
  user_id           uuid not null,
  started_at        timestamptz,
  ended_at          timestamptz,
  focus_minutes     smallint,
  capture_source    text,
  constraint fk_study_session_task_id foreign key (task_id) references learn.plan_task (task_id),
  constraint fk_study_session_user_id foreign key (user_id) references core.app_user (user_id)
);

-- ------------------------------------------------------------------- learn.topic_mastery
create table if not exists learn.topic_mastery (
  mastery_id              uuid primary key default gen_random_uuid(),
  user_id                 uuid not null,
  node_id                 uuid not null,
  mastery_score           numeric,
  attempt_count           integer,
  correct_ratio           numeric,
  average_time_seconds    numeric,
  last_practised_at       timestamptz,
  trend_direction         text,
  constraint fk_topic_mastery_user_id foreign key (user_id) references core.app_user (user_id),
  constraint fk_topic_mastery_node_id foreign key (node_id) references catalog.syllabus_node (node_id),
  constraint uq_topic_mastery_user_id_node_id unique (user_id, node_id)
);

-- ----------------------------------------------------------------------- learn.flashcard
create table if not exists learn.flashcard (
  flashcard_id     uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  node_id          uuid,
  question_id      uuid,
  front_text       text not null,
  back_text        text not null,
  card_type        text,
  created_from     text,
  constraint fk_flashcard_user_id foreign key (user_id) references core.app_user (user_id),
  constraint fk_flashcard_node_id foreign key (node_id) references catalog.syllabus_node (node_id),
  constraint fk_flashcard_question_id foreign key (question_id) references content.question (question_id)
);

-- --------------------------------------------------------------- learn.flashcard_review
create table if not exists learn.flashcard_review (
  flashcard_review_id   uuid primary key default gen_random_uuid(),
  flashcard_id          uuid not null,
  reviewed_at           timestamptz,
  recall_grade          smallint,
  ease_factor           numeric,
  interval_days         integer,
  next_due_on           date,
  constraint fk_flashcard_review_flashcard_id foreign key (flashcard_id) references learn.flashcard (flashcard_id)
);

-- ---------------------------------------------------------------------- learn.error_log
create table if not exists learn.error_log (
  error_log_id     uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  response_id      uuid not null,
  node_id          uuid not null,
  error_type       text not null,
  learner_note     text,
  is_resolved      boolean not null default false,
  logged_at        timestamptz,
  constraint fk_error_log_user_id foreign key (user_id) references core.app_user (user_id),
  constraint fk_error_log_response_id foreign key (response_id) references assess.attempt_response (response_id),
  constraint fk_error_log_node_id foreign key (node_id) references catalog.syllabus_node (node_id)
);

-- ------------------------------------------------------------------- learn.notification
create table if not exists learn.notification (
  notification_id    uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  channel            text,
  template_key       text,
  payload            jsonb,
  sent_at            timestamptz,
  read_at            timestamptz,
  constraint fk_notification_user_id foreign key (user_id) references core.app_user (user_id)
);

-- --------------------------------------------------------------------- learn.audit_log
create table if not exists learn.audit_log (
  audit_id           uuid primary key default gen_random_uuid(),
  actor_user_id      uuid,
  actor_type         text,
  action_name        text not null,
  entity_name        text not null,
  entity_key         text,
  change_payload     jsonb,
  occurred_at        timestamptz,
  constraint fk_audit_log_actor_user_id foreign key (actor_user_id) references core.app_user (user_id)
);
