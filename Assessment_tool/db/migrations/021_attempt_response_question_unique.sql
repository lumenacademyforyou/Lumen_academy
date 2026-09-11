-- 021_attempt_response_question_unique.sql
-- TE-P4 — upsertResponse needs to ON CONFLICT against (attempt_id,
-- question_id) uniformly for both FIXED and BLUEPRINT-mode responses
-- (test_question_id is null for BLUEPRINT-mode rows since 020, so the
-- existing (attempt_id, test_question_id) unique constraint can't serve as
-- the conflict target for those). Missed when 020 added question_id —
-- added here rather than editing 020 (R-4: applied migrations are never
-- edited).

create unique index if not exists ux_attempt_response_attempt_question
    on assess.attempt_response (attempt_id, question_id);

insert into util.applied_migration (migration_name) values ('021_attempt_response_question_unique')
on conflict (migration_name) do nothing;
