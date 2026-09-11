-- 033_recycled_items_tracking.sql
-- docs/no-repeat-questions-fix.md Phase 5. "Within a single attempt: repeats
-- are now impossible (Phases 3/4). Across attempts: the fallback [D-2,
-- least-recently-seen recycling once a scope's unseen pool is exhausted]
-- stays, but stops being silent." This migration adds the storage side:
-- an attempt-level flag+count (set by startAttempt/attempt-flow.ts) and a
-- per-unit log (one row per blueprint line that had to recycle anything)
-- that becomes the content team's authoring backlog, ordered by real
-- demand, per the spec's closing "Report back" instruction.

alter table assess.attempt
  add column if not exists has_recycled_items boolean not null default false,
  add column if not exists recycled_item_count integer not null default 0;

create table if not exists assess.unit_recycle_log (
  recycle_log_id    uuid primary key default gen_random_uuid(),
  attempt_id        uuid not null references assess.attempt (attempt_id) on delete cascade,
  subject_id        uuid not null references catalog.subject (subject_id),
  syllabus_node_id  uuid references catalog.syllabus_node (node_id),
  requested_count   integer not null,
  recycled_count    integer not null,
  logged_at         timestamptz not null default now()
);
create index if not exists ix_unit_recycle_log_subject_node on assess.unit_recycle_log (subject_id, syllabus_node_id);
create index if not exists ix_unit_recycle_log_attempt on assess.unit_recycle_log (attempt_id);

insert into util.applied_migration (migration_name) values ('033_recycled_items_tracking')
on conflict (migration_name) do nothing;
