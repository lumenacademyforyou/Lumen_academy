-- 013_content_import.sql
-- LA-CC-DB-001 Stage 6 (part 1/2 — the pipeline tables; 014_seed_pilot.sql
-- is the reference-data half and is blocked on SUPER_ADMIN_EMAIL /
-- PILOT_ADMIN_EMAIL, neither of which exists in .env — see conversation).
--
-- No survey needed: both new tables, zero dependents, nothing existing to
-- violate.

create table content.import_batch (
  batch_id             uuid primary key default gen_random_uuid(),
  batch_label          text not null,
  exam_id              uuid not null references catalog.exam(exam_id) on delete restrict,
  syllabus_version_id  uuid not null references catalog.syllabus_version(syllabus_version_id) on delete restrict,
  source_file          text not null,
  file_checksum        text not null,
  submitted_by         uuid not null references core.app_user(user_id) on delete restrict,
  batch_status         text not null default 'received',
  row_count            integer not null default 0,
  accepted_count        integer not null default 0,
  rejected_count        integer not null default 0,
  started_at           timestamptz not null default now(),
  finished_at          timestamptz,
  constraint uq_import_batch_checksum unique (file_checksum),
  constraint ck_import_batch_status check (batch_status in
    ('received','validating','validated','loading','loaded','failed','rolled_back'))
);

create table content.import_row (
  row_id        uuid primary key default gen_random_uuid(),
  batch_id      uuid not null references content.import_batch(batch_id) on delete cascade,
  row_no        integer not null,
  external_ref  text not null,
  raw_payload   jsonb not null,
  row_status    text not null default 'pending',
  question_id   uuid references content.question(question_id) on delete set null,
  error_code    text,
  error_detail  text,
  constraint uq_import_row_batch_no unique (batch_id, row_no),
  constraint ck_import_row_status check (row_status in ('pending','valid','invalid','loaded','skipped'))
);
create index ix_import_row_status on content.import_row (batch_id, row_status);
