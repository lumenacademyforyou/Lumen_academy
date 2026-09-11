-- 010_content_rich.sql
-- LA-CC-DB-001 Stage 3. Closes S-04 (no question-group/passage entity),
-- S-05 (no PYQ provenance), S-06 (no rich-content model beyond a generic
-- asset row), S-09 (question versioning not pinned), S-10 (source_document
-- has no natural key), S-11 (no node-scoped reading/video references), and
-- C-05 (primary_node_id / question_node_map can drift).
--
-- Discrepancies vs the brief, per rule 2 (introspected against the live
-- table just before writing this):
--  - content.question.numeric_answer and .answer_tolerance ALREADY EXIST
--    (both numeric, nullable). The brief assumed they were missing and
--    proposed adding numeric_answer + a new numeric_tolerance column. Not
--    re-added / not duplicated — the CHECK below reuses the existing
--    columns under their existing names.
--  - content.question.question_type's only live value is 'single_choice'
--    (20 rows), not 'mcq_single' as the brief's proposed CHECK vocabulary
--    assumes. Per rule 5 ("the intent is binding, the exact spelling is
--    not"), the CHECK below is built on the existing naming
--    (single_choice/multi_choice) rather than renaming 20 live rows to
--    match an external document's vocabulary.
--  - lifecycle_status's only live value is 'published' (20 rows) — included
--    in the CHECK alongside the brief's other lifecycle states.
--
-- Survey run before this file (see conversation): content.question has 20
-- rows, all question_type='single_choice', lifecycle_status='published',
-- numeric_answer null on all 20. content.asset and content.source_document
-- both have 0 rows. Zero backfill risk for any column/constraint below.

-- ---------------------------------------------------------------------------
-- Question groups (S-04): passages, matrix-match, common-data, assertion-
-- reason. A question belongs to a group via question.group_id +
-- group_sequence; ungrouped questions (the current 20) keep both null.
create table content.question_group (
  group_id        uuid primary key default gen_random_uuid(),
  group_type      text not null,
  stem_text       text,
  stem_format     text not null default 'latex',
  primary_node_id uuid references catalog.syllabus_node(node_id) on delete restrict,
  language_code   text not null default 'en',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint ck_qgroup_type   check (group_type in ('passage','common_data','matrix_match','assertion_reason')),
  constraint ck_qgroup_format check (stem_format in ('plain','markdown','latex','html'))
);

alter table content.question add column group_id       uuid references content.question_group(group_id) on delete restrict;
alter table content.question add column group_sequence smallint;
alter table content.question add constraint ck_question_group_seq
  check ((group_id is null and group_sequence is null) or (group_id is not null and group_sequence is not null));
create unique index uq_question_group_seq on content.question (group_id, group_sequence) where group_id is not null;

-- ---------------------------------------------------------------------------
-- Rich content + versioning on the question itself (S-06, S-09).
alter table content.question add column stem_format     text not null default 'latex';
alter table content.question add column solution_text   text;
alter table content.question add column solution_format text not null default 'latex';
alter table content.question add column has_image       boolean not null default false;
alter table content.question add column has_table       boolean not null default false;
alter table content.question add column has_math        boolean not null default false;
alter table content.question add column revision_no     integer not null default 1;
alter table content.question add column external_ref    text;

alter table content.question add constraint ck_question_stem_format
  check (stem_format in ('plain','markdown','latex','html'));
alter table content.question add constraint ck_question_solution_format
  check (solution_format in ('plain','markdown','latex','html'));
-- Adapted vocabulary — see the discrepancy note above.
alter table content.question add constraint ck_question_type
  check (question_type is null or question_type in
    ('single_choice','multi_choice','integer','numeric','matrix_match','assertion_reason','true_false'));
alter table content.question add constraint ck_question_lifecycle
  check (lifecycle_status in ('draft','in_review','approved','published','retired'));
create unique index uq_question_external_ref on content.question (external_ref) where external_ref is not null;

-- Reuses the existing numeric_answer/answer_tolerance columns rather than
-- adding new ones (see discrepancy note above). All 20 live rows have
-- question_type='single_choice' and numeric_answer null, so this passes
-- with zero backfill.
alter table content.question add constraint ck_question_numeric_answer
  check ((question_type in ('integer','numeric')) = (numeric_answer is not null));

-- ---------------------------------------------------------------------------
-- C-05: primary_node_id and question_node_map were two independent answers
-- to "which node owns this question" with nothing keeping them consistent.
-- Auto-inserts the mapping row on insert/update of primary_node_id; refuses
-- to delete the question_node_map row that mirrors the current
-- primary_node_id (must change primary_node_id first, not delete out from
-- under it).
create or replace function content.trg_question_primary_node_sync() returns trigger as $$
begin
  insert into content.question_node_map (question_id, node_id, relevance_rank)
    values (new.question_id, new.primary_node_id, 1)
    on conflict (question_id, node_id) do nothing;
  return new;
end;
$$ language plpgsql;

create trigger trg_question_primary_node_sync
  after insert or update of primary_node_id on content.question
  for each row execute function content.trg_question_primary_node_sync();

create or replace function content.trg_question_node_map_guard() returns trigger as $$
declare
  v_primary uuid;
begin
  select primary_node_id into v_primary from content.question where question_id = old.question_id;
  if v_primary = old.node_id then
    raise exception 'question_node_map: cannot delete the row matching question %''s primary_node_id — change primary_node_id first', old.question_id;
  end if;
  return old;
end;
$$ language plpgsql;

create trigger trg_question_node_map_guard
  before delete on content.question_node_map
  for each row execute function content.trg_question_node_map_guard();

-- Backfill: every existing question's primary_node_id already has a
-- matching question_node_map row or not — insert whichever are missing, for
-- the 20 live rows, so the invariant holds retroactively as well as
-- going forward.
insert into content.question_node_map (question_id, node_id, relevance_rank)
select q.question_id, q.primary_node_id, 1
from content.question q
where not exists (
  select 1 from content.question_node_map m where m.question_id = q.question_id and m.node_id = q.primary_node_id
)
on conflict (question_id, node_id) do nothing;

-- ---------------------------------------------------------------------------
-- Rich-content asset extension (S-06). Extends the existing asset table
-- rather than creating a competing one.
--
-- Discrepancy vs the brief: content.asset already has alt_text (reused
-- as-is, not re-added) and an asset_type text column with 0 live rows
-- (content.asset is currently empty) that serves the exact purpose the
-- brief's proposed new asset_kind column would. Repurposing the existing,
-- unused asset_type column with the CHECK vocabulary below rather than
-- adding a second, overlapping classification column on the same table.
alter table content.asset add column option_id      uuid references content.question_option(option_id) on delete cascade;
alter table content.asset add column group_id       uuid references content.question_group(group_id)   on delete cascade;
alter table content.asset add column target_role    text not null default 'stem';
alter table content.asset add column mime_type      text;
alter table content.asset add column inline_payload text;
alter table content.asset add column width_px       integer;
alter table content.asset add column height_px      integer;
alter table content.asset add column byte_size      bigint;
alter table content.asset add column checksum_sha256 text;
alter table content.asset add column display_order  smallint not null default 0;

-- storage_uri was NOT NULL, which would make an inline_payload-only asset
-- (a table/markup fragment with no binary file) impossible to insert even
-- though ck_asset_payload below explicitly allows it. 0 live rows
-- (surveyed above) — safe to loosen with no backfill.
alter table content.asset alter column storage_uri drop not null;
alter table content.asset alter column asset_type set default 'image';
alter table content.asset add constraint ck_asset_target_role
  check (target_role in ('stem','option','solution','hint','passage','explanation'));
alter table content.asset add constraint ck_asset_type
  check (asset_type in ('image','diagram','graph','chemical_structure','table','audio','video'));
alter table content.asset add constraint ck_asset_payload
  check (storage_uri is not null or inline_payload is not null);
alter table content.asset add constraint ck_asset_owner
  check (num_nonnulls(question_id, document_id, group_id) >= 1);

-- ---------------------------------------------------------------------------
-- PYQ provenance (S-05).
create table content.question_source (
  question_id  uuid primary key references content.question(question_id) on delete cascade,
  source_type  text not null,
  exam_id      uuid references catalog.exam(exam_id) on delete restrict,
  cycle_id     uuid references catalog.exam_cycle(cycle_id) on delete restrict,
  paper_code   text,
  shift_code   text,
  sitting_date date,
  question_no  smallint,
  source_note  text,
  constraint ck_qsource_type check (source_type in ('pyq','authored','mock','textbook')),
  constraint ck_qsource_pyq  check (source_type <> 'pyq' or (cycle_id is not null and paper_code is not null))
);
create unique index uq_question_source_pyq
  on content.question_source (cycle_id, paper_code, coalesce(shift_code,''), question_no)
  where source_type = 'pyq';

-- ---------------------------------------------------------------------------
-- S-10: no natural key existed, so the same NCERT text could be inserted
-- twice. 0 live rows (surveyed above) — applies with no dedup needed.
create unique index uq_source_document_natural
  on content.source_document (subject_id, lower(title), coalesce(edition_year, 0));

-- ---------------------------------------------------------------------------
-- S-11: node-scoped reading and video references — the single place both
-- resource kinds live, so "show the NCERT chapter and the video for this
-- study-plan task's node" becomes answerable. Not a second video table.
create table content.node_resource_ref (
  ref_id         uuid primary key default gen_random_uuid(),
  node_id        uuid not null references catalog.syllabus_node(node_id) on delete cascade,
  resource_type  text not null,
  document_id    uuid references content.source_document(document_id) on delete cascade,
  page_from      integer,
  page_to        integer,
  video_uri      text,
  video_provider text,
  duration_sec   integer,
  title          text not null,
  display_order  smallint not null default 0,
  created_at     timestamptz not null default now(),
  constraint ck_node_resource_type check (resource_type in ('reading','video','notes','practice')),
  constraint ck_node_resource_payload check (
    (resource_type = 'reading' and document_id is not null) or
    (resource_type = 'video'   and video_uri  is not null) or
    (resource_type in ('notes','practice'))),
  constraint ck_node_resource_pages check (page_from is null or page_to is null or page_to >= page_from)
);
create index ix_node_resource_node on content.node_resource_ref (node_id, resource_type, display_order);
