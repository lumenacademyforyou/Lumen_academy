-- 004_assess.sql
-- Lumen Academy — assess schema: 9 relations.
--
-- Sources: docs/db/SCHEMA_SPEC.md (keys, FK edge list),
-- docs/design/03_conceptual_er_low_level_revA.md (descriptive attribute names),
-- docs/design/LA-DBD-004_backend_schema_map.md (fills a genuine attribute-name
-- gap for assess.attempt — see note below; used only where it doesn't conflict
-- with SCHEMA_SPEC's key structure).
-- Depends on: 001_catalog.sql, 002_core.sql, 003_content.sql.
--
-- assess.attempt: low-level ER's extraction only yields 6 clean attributes
-- (started_at, submitted_at, elapsed_seconds, attempt_state,
-- device_fingerprint, sync_state) against SCHEMA_SPEC's stated "+7". The 7th,
-- server_deadline, comes from LA-DBD-004_backend_schema_map.md, which lists
-- the same 7 and is corroborated by LA-ARC-005's repeated emphasis that
-- server_deadline (not the client clock) is the authoritative deadline.
--
-- assess.test_assignment: low-level ER gives 5 names (audience_type, scopes,
-- assigned_on, due_on, assignment_status) against a stated "+4" — kept all 5
-- rather than guess which to drop.
--
-- Nullable FKs, judgment calls (all plain/unannotated in SCHEMA_SPEC, made
-- nullable based on documented domain flow rather than left NOT NULL by
-- default — flagging since this deviates from this file's usual default):
--   test_assignment.user_id / batch_id — audience_type exists specifically to
--     discriminate an individual-targeted vs batch-targeted assignment, which
--     only makes sense if exactly one of the two is set.
--   attempt.assignment_id — LA-ARC-005's attempt-start flow doesn't require a
--     prior assignment; self-serve/practice attempts are implied elsewhere.
--   attempt_response.option_id — a response may hold numeric_answer instead
--     (numeric-answer questions), or be unanswered.

-- --------------------------------------------------------------------- assess.test
create table if not exists assess.test (
  test_id              uuid primary key default gen_random_uuid(),
  test_code            text not null,
  pattern_id           uuid not null,
  cycle_id             uuid not null,
  created_by           uuid not null,
  title                text not null,
  test_mode            text,
  language_set         jsonb not null default '[]'::jsonb,
  total_marks          numeric,
  duration_minutes     smallint,
  window_opens_at      timestamptz,
  window_closes_at     timestamptz,
  test_status          text not null,
  constraint fk_test_pattern_id foreign key (pattern_id) references catalog.exam_pattern (pattern_id),
  constraint fk_test_cycle_id foreign key (cycle_id) references catalog.exam_cycle (cycle_id),
  constraint fk_test_created_by foreign key (created_by) references core.app_user (user_id),
  constraint uq_test_test_code unique (test_code)
);

-- ----------------------------------------------------------------- assess.test_section
create table if not exists assess.test_section (
  test_section_id      uuid primary key default gen_random_uuid(),
  test_id              uuid not null,
  pattern_section_id   uuid not null,
  section_name         text not null,
  sequence_no          smallint not null,
  question_count       smallint,
  section_marks        numeric,
  constraint fk_test_section_test_id foreign key (test_id) references assess.test (test_id),
  constraint fk_test_section_pattern_section_id foreign key (pattern_section_id) references catalog.pattern_section (pattern_section_id),
  constraint uq_test_section_test_id_sequence_no unique (test_id, sequence_no)
);

-- ---------------------------------------------------------------- assess.test_question
create table if not exists assess.test_question (
  test_question_id     uuid primary key default gen_random_uuid(),
  test_section_id      uuid not null,
  question_id          uuid not null,
  sequence_no          smallint not null,
  marks_override       numeric,
  is_optional          boolean not null default false,
  shuffle_seed         bigint,
  constraint fk_test_question_test_section_id foreign key (test_section_id) references assess.test_section (test_section_id),
  constraint fk_test_question_question_id foreign key (question_id) references content.question (question_id),
  constraint uq_test_question_test_section_id_sequence_no unique (test_section_id, sequence_no)
);

-- ------------------------------------------------------------- assess.test_assignment
create table if not exists assess.test_assignment (
  assignment_id        uuid primary key default gen_random_uuid(),
  test_id              uuid not null,
  user_id              uuid,
  batch_id             uuid,
  audience_type        text,
  scopes               jsonb,
  assigned_on          date,
  due_on               date,
  assignment_status    text not null,
  constraint fk_test_assignment_test_id foreign key (test_id) references assess.test (test_id),
  constraint fk_test_assignment_user_id foreign key (user_id) references core.app_user (user_id),
  constraint fk_test_assignment_batch_id foreign key (batch_id) references core.batch (batch_id)
);

-- ------------------------------------------------------------------ assess.attempt
create table if not exists assess.attempt (
  attempt_id            uuid primary key default gen_random_uuid(),
  test_id               uuid not null,
  user_id               uuid not null,
  assignment_id         uuid,
  attempt_no            smallint not null,
  started_at            timestamptz,
  server_deadline       timestamptz,
  submitted_at          timestamptz,
  elapsed_seconds       integer,
  attempt_state         text not null,
  device_fingerprint    text,
  sync_state            text,
  constraint fk_attempt_test_id foreign key (test_id) references assess.test (test_id),
  constraint fk_attempt_user_id foreign key (user_id) references core.app_user (user_id),
  constraint fk_attempt_assignment_id foreign key (assignment_id) references assess.test_assignment (assignment_id),
  constraint uq_attempt_test_id_user_id_attempt_no unique (test_id, user_id, attempt_no)
);

-- --------------------------------------------------------------- assess.attempt_response
create table if not exists assess.attempt_response (
  response_id              uuid primary key default gen_random_uuid(),
  attempt_id               uuid not null,
  test_question_id         uuid not null,
  option_id                uuid,
  selected_option_label    text,
  numeric_answer           numeric,
  response_state           text not null,
  time_spent_seconds       integer,
  visit_count              smallint,
  is_correct               boolean,
  marks_awarded            numeric,
  constraint fk_attempt_response_attempt_id foreign key (attempt_id) references assess.attempt (attempt_id),
  constraint fk_attempt_response_test_question_id foreign key (test_question_id) references assess.test_question (test_question_id),
  constraint fk_attempt_response_option_id foreign key (option_id) references content.question_option (option_id),
  constraint uq_attempt_response_attempt_id_test_question_id unique (attempt_id, test_question_id)
);

-- ----------------------------------------------------------------- assess.attempt_event
create table if not exists assess.attempt_event (
  event_id          uuid primary key default gen_random_uuid(),
  attempt_id        uuid not null,
  event_type        text not null,
  event_at          timestamptz,
  event_payload     jsonb,
  constraint fk_attempt_event_attempt_id foreign key (attempt_id) references assess.attempt (attempt_id)
);

-- ---------------------------------------------------------------------- assess.scorecard
create table if not exists assess.scorecard (
  scorecard_id       uuid primary key default gen_random_uuid(),
  attempt_id         uuid not null,
  obtained_marks     numeric,
  total_marks        numeric,
  accuracy_percent   numeric,
  percentile         numeric,
  rank_in_cohort     integer,
  generated_at       timestamptz,
  constraint fk_scorecard_attempt_id foreign key (attempt_id) references assess.attempt (attempt_id),
  constraint uq_scorecard_attempt_id unique (attempt_id)
);

-- ------------------------------------------------------------------ assess.section_score
create table if not exists assess.section_score (
  section_score_id       uuid primary key default gen_random_uuid(),
  scorecard_id           uuid not null,
  test_section_id        uuid not null,
  obtained_marks         numeric,
  attempted_count        smallint,
  correct_count          smallint,
  average_time_seconds   numeric,
  constraint fk_section_score_scorecard_id foreign key (scorecard_id) references assess.scorecard (scorecard_id),
  constraint fk_section_score_test_section_id foreign key (test_section_id) references assess.test_section (test_section_id),
  constraint uq_section_score_scorecard_id_test_section_id unique (scorecard_id, test_section_id)
);
