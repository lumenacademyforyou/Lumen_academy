-- 024_asset_rename_log.sql
-- docs/neet-tool-fix-prompt.md Task 3b, Steps 4-5.
--
-- Step 5a (FK question_id -> questions(id)): already existed since
-- 003_content.sql (fk_asset_question_id, references content.question,
-- default RESTRICT/NO ACTION on delete — a question row can't be deleted
-- out from under a live asset reference; explicit, not an accident of
-- Postgres defaults, and left as-is rather than re-declared here).
--
-- Step 5b: unique constraint on (question_id, slot, sequence) so one slot
-- can't accumulate conflicting images. This schema's "slot" is target_role
-- for a stem/passage/solution/etc. asset, or (target_role, option_id) for
-- an option-level one (two different options both use target_role='option'
-- but are different slots) — modelled as a single partial-unique-friendly
-- expression via coalesce(option_id::text, target_role). "Sequence" is the
-- pre-existing display_order column (010_content_rich.sql), already the
-- de-facto ordinal within a slot.
alter table content.asset
  add column if not exists slot_key text
  generated always as (coalesce(option_id::text, target_role)) stored;

create unique index if not exists ux_asset_question_slot_sequence
  on content.asset (question_id, slot_key, display_order)
  where question_id is not null;

-- Step 4: audit trail for the canonical-filename rename (Task 3b Step 3).
-- Populated by db/scripts/manual/rename-image-assets.ts when that pass
-- actually runs — this migration only creates the table; 0 rows on apply.
create table if not exists content.asset_rename_log (
    log_id       uuid primary key default gen_random_uuid(),
    asset_id     uuid not null references content.asset(asset_id) on delete cascade,
    old_path     text not null,
    new_path     text not null,
    question_id  uuid references content.question(question_id),
    slot         text not null,
    resolution   text not null check (resolution in ('ok', 'reassigned', 'confirmed_shared')),
    reviewed_by  text,
    renamed_at   timestamptz not null default now()
);
create index if not exists ix_asset_rename_log_asset on content.asset_rename_log (asset_id);

insert into util.applied_migration (migration_name) values ('024_asset_rename_log')
on conflict (migration_name) do nothing;
