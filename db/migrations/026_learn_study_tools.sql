-- 026_learn_study_tools.sql
-- Phase 7 (docs/assessment-tool-debug-plan.md) — BUG-19/20/21/22. learn.study_plan
-- and learn.plan_task (005_learn.sql) already exist but were never wired to
-- the frontend's "Study Plan" screen (StudyPlanView.tsx): that screen's
-- ChapterGoal checklist is deliberately catalog-decoupled (subject/chapter
-- are plain strings, not catalog.syllabus_node uuids — see that file's own
-- comments on why a fuzzy name-match isn't reliable enough to persist as a
-- foreign key), which doesn't fit plan_task's mandatory node_id FK. Custom
-- tasks and notes (StudyPlanView.tsx's other two CRUD panels) point at
-- Supabase tables (`user_tasks`, `user_notes`) that were never migrated at
-- all — confirmed via grep, no `create table` for either anywhere in
-- db/migrations/. This migration adds the real, missing persistence for all
-- three, plus a real pomodoro-session log (previously localStorage-only,
-- invisible to the demo-account reset and lost on device change).

-- learn.study_plan: BUG-19 — "create once, edit anytime" needs an actual
-- constraint, not just a hidden button; updated_at for real edit tracking;
-- config for the screen's 4 configurator fields (target exam year, current
-- score level, daily hours, focus area) that don't map to any existing
-- column and don't warrant one column each for a single free-form blob.
alter table learn.study_plan add column if not exists config jsonb not null default '{}'::jsonb;
alter table learn.study_plan add column if not exists created_at timestamptz not null default now();
alter table learn.study_plan add column if not exists updated_at timestamptz not null default now();
create unique index if not exists uq_study_plan_one_active_per_user
  on learn.study_plan (user_id) where plan_status = 'active';

-- learn.study_plan_goal: the "items" BUG-19 asks to add/remove/reorder —
-- StudyPlanView.tsx's ChapterGoal checklist, now persisted per plan instead
-- of a hardcoded in-memory default array.
create table if not exists learn.study_plan_goal (
  goal_id         uuid primary key default gen_random_uuid(),
  plan_id         uuid not null references learn.study_plan(plan_id) on delete cascade,
  subject         text not null,
  chapter         text not null,
  high_yield_tag  text,
  hours_needed    smallint,
  is_completed    boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists ix_study_plan_goal_plan_id on learn.study_plan_goal (plan_id, sort_order);

-- learn.custom_task: BUG-20 — a lightweight, ad-hoc task list independent of
-- the structured plan (no plan/catalog-node dependency), matching what
-- StudyPlanView.tsx's "My Custom Study Tasks" panel actually needs.
create table if not exists learn.custom_task (
  task_id       uuid primary key default gen_random_uuid(),
  user_id       uuid not null references core.app_user(user_id),
  title         text not null,
  subject       text,
  is_completed  boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists ix_custom_task_user_id on learn.custom_task (user_id, created_at desc);

-- learn.revision_note: BUG-21.
create table if not exists learn.revision_note (
  note_id     uuid primary key default gen_random_uuid(),
  user_id     uuid not null references core.app_user(user_id),
  subject     text,
  topic       text,
  title       text not null,
  content     text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists ix_revision_note_user_id on learn.revision_note (user_id, updated_at desc);

-- learn.pomodoro_session: BUG-22 — real server-side log, replacing the
-- localStorage-only history PomodoroTimer.tsx currently keeps
-- (frontend/src/services/studySessionService.ts). Columns beyond the bare
-- minimum (subject, task_title, session_type, rating, notes) mirror that
-- file's existing StudySession shape exactly, so the dashboard's streak/
-- subject-breakdown calculations (calculateStudyStreak, calculateSessionStats
-- — both pure functions over the session list) keep working unchanged once
-- fed real rows instead of localStorage ones.
create table if not exists learn.pomodoro_session (
  session_id        uuid primary key default gen_random_uuid(),
  user_id           uuid not null references core.app_user(user_id),
  task_id           uuid references learn.custom_task(task_id) on delete set null,
  subject           text,
  task_title        text,
  session_type      text not null default 'focus',
  started_at        timestamptz not null,
  duration_seconds  integer not null,
  is_completed      boolean not null default true,
  rating            smallint,
  notes             text,
  created_at        timestamptz not null default now()
);
alter table learn.pomodoro_session add column if not exists subject text;
alter table learn.pomodoro_session add column if not exists task_title text;
alter table learn.pomodoro_session add column if not exists session_type text not null default 'focus';
alter table learn.pomodoro_session add column if not exists rating smallint;
alter table learn.pomodoro_session add column if not exists notes text;
create index if not exists ix_pomodoro_session_user_id on learn.pomodoro_session (user_id, created_at desc);

insert into util.applied_migration (migration_name) values ('026_learn_study_tools')
on conflict (migration_name) do nothing;
