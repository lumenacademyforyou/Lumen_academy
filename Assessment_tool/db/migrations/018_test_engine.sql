-- 018_test_engine.sql
-- TE-P1 — test engine schema completion (LA-BE-ENGINE-001 Section 6).
--
-- Substitutions used instead of duplicating an existing equivalent
-- (TE-P1 work item 2 / R-3 "no redesign"), each checked against
-- docs/DB_STATE.md before writing this file:
--   * assess.test.source_type ('authored'|'pyq'|'generated') already
--     distinguishes a pre-ingested paper from a system-assembled one —
--     used as the FIXED/BLUEPRINT signal ('generated' = BLUEPRINT, anything
--     else = FIXED) instead of adding a new assembly_mode column.
--   * assess.attempt.server_deadline already holds the attempt's deadline —
--     used instead of adding a new deadline_at column.
--   * catalog.subject is already exam-scoped (subject.exam_id NOT NULL) —
--     used directly for assess.test_blueprint's subject scope instead of a
--     separate "exam_subject" entity.
--   * assess.test_question already has a unique index on
--     (test_section_id, question_id) — the brief's ux_test_question_unique
--     is already satisfied, not added again.
-- Enum-like text values below use this schema's existing lowercase
-- snake_case convention (attempt_state, test_status, question_type, etc.),
-- not the brief's UPPER_CASE literals, per R-12.

-- Migration ledger for the raw-SQL track. TE-P0 (docs/DB_STATE.md §1)
-- confirmed none exists. 000-017 have no recorded original apply time;
-- applied_at for them is backfilled to this migration's run time, not the
-- true historical time, which is unrecoverable.
create table if not exists util.applied_migration (
    migration_name text        primary key,
    applied_at      timestamptz not null default now()
);

insert into util.applied_migration (migration_name) values
    ('000_foundation'), ('001_catalog'), ('002_core'), ('003_content'),
    ('004_assess'), ('005_learn'), ('006_pgvector_index'),
    ('007_core_mobile_nullable'), ('008_catalog_taxonomy'), ('009_core_rbac'),
    ('010_content_rich'), ('011_assess_scope'), ('012_domain_checks'),
    ('013_content_import'), ('014_core_status_expansion'),
    ('015_core_invitation'), ('016_core_rls_lockdown'),
    ('017_core_member_code'), ('018_test_engine')
on conflict (migration_name) do nothing;

-- Anti-repetition ledger (D-1 decision D-2). One row per student per
-- question ever served.
create table if not exists assess.user_question_seen (
    user_id                uuid        not null references core.app_user(user_id) on delete cascade,
    question_id            uuid        not null references content.question(question_id) on delete cascade,
    first_seen_at          timestamptz not null default now(),
    last_seen_at           timestamptz not null default now(),
    times_seen             integer     not null default 1 check (times_seen > 0),
    last_seen_attempt_seq  integer     not null,
    was_correct_last       boolean,
    primary key (user_id, question_id)
);
create index if not exists ix_user_question_seen_user_seq
    on assess.user_question_seen (user_id, last_seen_attempt_seq desc);

-- Pause ledger. Server-authoritative elapsed time (R-10).
create table if not exists assess.attempt_pause (
    pause_id    uuid        primary key default gen_random_uuid(),
    attempt_id  uuid        not null references assess.attempt(attempt_id) on delete cascade,
    paused_at   timestamptz not null default now(),
    resumed_at  timestamptz,
    constraint ck_attempt_pause_order check (resumed_at is null or resumed_at >= paused_at)
);
create unique index if not exists ux_attempt_pause_one_open
    on assess.attempt_pause (attempt_id) where resumed_at is null;

-- Idempotency for attempt start and submit (D-7).
create table if not exists assess.idempotency_key (
    key           text        primary key,
    user_id       uuid        not null references core.app_user(user_id) on delete cascade,
    operation     text        not null check (operation in ('attempt_start', 'attempt_submit')),
    subject_id    uuid,
    response_body jsonb       not null,
    created_at    timestamptz not null default now()
);
create index if not exists ix_idempotency_key_created on assess.idempotency_key (created_at);

-- Blueprint definition for BLUEPRINT-mode assembly (D-1). difficulty_band is
-- free text with no CHECK, mirroring content.question.difficulty_band
-- (also unconstrained free text today — see docs/DB_STATE.md §4.4).
create table if not exists assess.test_blueprint (
    blueprint_id         uuid        primary key default gen_random_uuid(),
    test_id              uuid        not null references assess.test(test_id) on delete cascade,
    test_section_id      uuid        not null references assess.test_section(test_section_id) on delete cascade,
    subject_id           uuid        not null references catalog.subject(subject_id),
    syllabus_node_id     uuid            null references catalog.syllabus_node(node_id),
    include_descendants  boolean     not null default true,
    difficulty_band      text,
    question_format      text        check (
        question_format is null or question_format = any (array[
            'single_choice', 'multi_choice', 'integer', 'numeric',
            'matrix_match', 'assertion_reason', 'true_false'
        ])
    ),
    pick_count           smallint    not null check (pick_count > 0)
);
create index if not exists ix_test_blueprint_test on assess.test_blueprint (test_id);

-- Attempt columns TE-P4 needs that aren't already present. deadline_at and
-- assembly_mode are deliberately not added here — see substitutions note.
alter table assess.attempt
    add column if not exists paused_ms_total  bigint  not null default 0,
    add column if not exists attempt_seq      integer,
    add column if not exists submitted_reason text
        check (submitted_reason is null or submitted_reason in ('student', 'expiry', 'admin', 'sweeper'));

-- Widen attempt_state to add the paused state TE-P4's state machine needs.
-- assess.attempt is 0 rows live (docs/DB_STATE.md §5) — safe to drop/re-add
-- directly, nothing to backfill or validate against.
alter table assess.attempt drop constraint ck_attempt_state;
alter table assess.attempt add constraint ck_attempt_state
    check (attempt_state = any (array['in_progress', 'paused', 'submitted', 'scored', 'abandoned']));

-- Hot-path indexes docs/DB_STATE.md §4.5 confirmed are missing. The
-- attempt-response upsert path is already covered by the existing unique
-- index on (attempt_id, test_question_id) — not duplicated here.
create index if not exists ix_attempt_user_started on assess.attempt (user_id, started_at desc);
create index if not exists ix_question_node_map_node on content.question_node_map (node_id);
create index if not exists ix_question_lifecycle_published
    on content.question (lifecycle_status) where lifecycle_status = 'published';
