-- 025_unit_materials.sql
-- docs/neet-tool-fix-prompt.md Task 4a — course syllabus materials from
-- Google Drive, mapped to catalog units. drive_file_id only (never a full
-- share URL) — URLs are built in code (frontend Drive-preview iframe embed
-- + backend download redirect), matching the task's own instruction.
create table if not exists learn.unit_material (
    id            uuid primary key default gen_random_uuid(),
    unit_id       uuid        not null references catalog.syllabus_node(node_id) on delete cascade,
    title         text        not null,
    drive_file_id text        not null,
    mime_type     text        not null default 'application/pdf',
    sort_order    smallint    not null default 0,
    is_active     boolean     not null default true,
    created_at    timestamptz not null default now()
);
create index if not exists ix_unit_material_unit on learn.unit_material (unit_id, sort_order) where is_active;

insert into util.applied_migration (migration_name) values ('025_unit_materials')
on conflict (migration_name) do nothing;
