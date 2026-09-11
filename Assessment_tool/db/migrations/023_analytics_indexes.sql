-- 023_analytics_indexes.sql
-- LA-APP-COMPLETION-001 Phase G, G1 — indexes for the dashboard/analytics
-- query patterns (attempt history, score trend, per-subject/unit/difficulty
-- accuracy, time-per-question, weakest units, unattempted rate), added
-- before those queries are written per the directive's own ordering.
--
-- Every one of these queries is scoped to one user's own scored attempts
-- (assess.attempt.user_id = $1 and attempt_state = 'scored'), then joins
-- outward from there via already-indexed paths:
--   * assess.attempt_question (attempt_id) — ix_attempt_question_attempt (018)
--   * assess.attempt_response (attempt_id, question_id) — ux_attempt_response_
--     attempt_question (021), leading column attempt_id
--   * content.question / catalog.syllabus_node — looked up by primary key
--     (question_id / node_id), not filtered, so no new index earns its keep
--     there
-- The one gap: nothing indexes assess.attempt for "this user's scored
-- attempts, newest first" — ix_attempt_user_started (018) only covers
-- started_at and every attempt_state, not just scored ones. That's the
-- entry point every G2 query above starts from, so it's the one real
-- addition here.
create index if not exists ix_attempt_user_submitted_scored
    on assess.attempt (user_id, submitted_at desc)
    where attempt_state = 'scored';

insert into util.applied_migration (migration_name) values ('023_analytics_indexes')
on conflict (migration_name) do nothing;
