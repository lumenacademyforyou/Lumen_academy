-- 008_catalog_taxonomy.sql
-- LA-CC-DB-001 Stage 1. Closes S-03 (syllabus_node has no enforced level
-- structure) and C-03 (exam_pattern.is_current has no uniqueness), plus the
-- marking-scheme-override fix for C-06 that the brief groups into this same
-- migration.
--
-- Pre-DDL survey (run before this file, see conversation): catalog.exam has
-- 1 row (NEET); catalog.syllabus_node has 38 rows, all node_type='unit'
-- depth=0 (flat today — no chapter/topic split exists yet, so this is
-- genuinely new structure, not a backfill hazard); catalog.pattern_section
-- has 4 rows, none with scheme_id null (safe to loosen to nullable);
-- catalog.exam_pattern has exactly 1 row with is_current=true per cycle
-- already (the new partial unique index applies cleanly, zero violators).

-- ---------------------------------------------------------------------------
-- Exam family (S-08): groups exams for shared syllabus/combined analytics
-- (e.g. JEE Main + JEE Advanced under one "JEE" family). Nullable FK for now
-- — 014_seed_pilot.sql backfills existing exam rows and only then sets
-- exam.family_id NOT NULL, per the brief's own sequencing.
create table catalog.exam_family (
  family_id   uuid primary key default gen_random_uuid(),
  family_code text not null,
  family_name text not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint uq_exam_family_code unique (family_code)
);

alter table catalog.exam add column family_id uuid;
alter table catalog.exam add constraint fk_exam_family_id
  foreign key (family_id) references catalog.exam_family(family_id) on delete restrict;

-- ---------------------------------------------------------------------------
-- Node level (S-03): declares the ordered level structure per exam (subject
-- -> unit -> chapter -> topic, or an exam-specific variant) so the syllabus
-- tree has a rule to obey instead of accepting any node_type/depth silently.
create table catalog.node_level (
  level_id    uuid primary key default gen_random_uuid(),
  exam_id     uuid not null references catalog.exam(exam_id) on delete cascade,
  level_no    smallint not null,
  level_code  text not null,
  level_label text not null,
  is_taggable boolean not null default false,
  created_at  timestamptz not null default now(),
  constraint uq_node_level_exam_no   unique (exam_id, level_no),
  constraint uq_node_level_exam_code unique (exam_id, level_code),
  constraint ck_node_level_no        check (level_no between 1 and 6),
  constraint ck_node_level_code      check (level_code in
    ('subject','domain','unit','chapter','topic','subtopic'))
);

-- ---------------------------------------------------------------------------
-- syllabus_node taxonomy columns. All nullable or defaulted so the 38
-- existing rows (untagged, flat) are untouched until someone opts a row into
-- the new taxonomy by setting node_code — see the trigger below, which is
-- deliberately conditional on that for the same reason.
alter table catalog.syllabus_node add column level_no    smallint;
alter table catalog.syllabus_node add column node_code   text;
alter table catalog.syllabus_node add column node_path   text;
alter table catalog.syllabus_node add column sort_order  integer not null default 0;
alter table catalog.syllabus_node add column is_active   boolean not null default true;

create unique index uq_syllabus_node_path
  on catalog.syllabus_node (syllabus_version_id, node_path);
create unique index uq_syllabus_node_code_parent
  on catalog.syllabus_node (syllabus_version_id, coalesce(parent_node_id, '00000000-0000-0000-0000-000000000000'::uuid), node_code);
create index ix_syllabus_node_path_prefix
  on catalog.syllabus_node using gin (node_path gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- trg_syllabus_node_hierarchy: enforces level/parent/path rules, but ONLY
-- when the caller supplies node_code — i.e. only for rows opting into the
-- new taxonomy. This is a deliberate adaptation from the brief's literal
-- wording ("enforcing all of...", unconditional): the 38 existing rows, and
-- any existing write path through catalog.routes.ts's generic CRUD router,
-- create/update syllabus_node without node_code today. An unconditional
-- trigger would break that live path immediately, before node_level has any
-- seeded rows to validate against (014 seeds them, three stages later).
-- Untagged rows (node_code IS NULL) pass through unchanged, exactly as
-- before this migration.
create or replace function catalog.trg_syllabus_node_hierarchy() returns trigger as $$
declare
  v_exam_id uuid;
  v_parent catalog.syllabus_node%rowtype;
  v_expected_level smallint;
  v_level_code text;
begin
  if new.node_code is null then
    return new;
  end if;

  select exam_id into v_exam_id from catalog.syllabus_version where syllabus_version_id = new.syllabus_version_id;
  if v_exam_id is null then
    raise exception 'syllabus_node: syllabus_version_id % has no resolvable exam_id', new.syllabus_version_id;
  end if;

  if new.parent_node_id is null then
    v_expected_level := 1;
  else
    select * into v_parent from catalog.syllabus_node where node_id = new.parent_node_id;
    if not found then
      raise exception 'syllabus_node: parent_node_id % does not exist', new.parent_node_id;
    end if;
    if v_parent.syllabus_version_id <> new.syllabus_version_id then
      raise exception 'syllabus_node: parent % belongs to a different syllabus_version', new.parent_node_id;
    end if;
    v_expected_level := coalesce(v_parent.level_no, 0) + 1;
  end if;

  if new.level_no is null then
    new.level_no := v_expected_level;
  elsif new.level_no <> v_expected_level then
    raise exception 'syllabus_node: level_no % does not match expected level % for this parent', new.level_no, v_expected_level;
  end if;

  select level_code into v_level_code from catalog.node_level where exam_id = v_exam_id and level_no = new.level_no;
  if v_level_code is null then
    raise exception 'syllabus_node: no catalog.node_level row for exam % level_no %', v_exam_id, new.level_no;
  end if;
  new.node_type := v_level_code;

  if new.parent_node_id is null then
    new.node_path := '/' || new.node_code;
  else
    new.node_path := v_parent.node_path || '/' || new.node_code;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_syllabus_node_hierarchy
  before insert or update of node_code, parent_node_id, level_no on catalog.syllabus_node
  for each row execute function catalog.trg_syllabus_node_hierarchy();

-- Cascade-recompute descendants' node_path when a tagged parent's own path
-- changes (node_code or parent_node_id edited after the fact). Separate
-- AFTER trigger so it runs once the row's own new node_path is committed.
create or replace function catalog.trg_syllabus_node_path_cascade() returns trigger as $$
begin
  if new.node_path is distinct from old.node_path then
    update catalog.syllabus_node child
       set node_path = new.node_path || substring(child.node_path from length(old.node_path) + 1)
     where child.parent_node_id = new.node_id
       and child.node_path is not null
       and child.node_path like old.node_path || '/%';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_syllabus_node_path_cascade
  after update of node_path on catalog.syllabus_node
  for each row execute function catalog.trg_syllabus_node_path_cascade();

-- ---------------------------------------------------------------------------
-- C-03: at most one current pattern per cycle. Zero existing violators
-- (surveyed above), applies cleanly.
create unique index uq_exam_pattern_current_per_cycle
  on catalog.exam_pattern (cycle_id) where is_current;

-- ---------------------------------------------------------------------------
-- C-06: a section's marking scheme was mandatory and independent of its
-- pattern's scheme, so a section could silently contradict its own pattern.
-- Nullable now means "inherit the pattern's scheme"; existing rows keep
-- their explicit values (surveyed above: 0 nulls today, so this is a pure
-- loosening, not a data change). All scoring code must read
-- catalog.v_section_marking, never pattern_section.scheme_id directly.
alter table catalog.pattern_section alter column scheme_id drop not null;

create or replace view catalog.v_section_marking as
select
  ps.pattern_section_id,
  ps.pattern_id,
  coalesce(ps.scheme_id, ep.scheme_id) as effective_scheme_id
from catalog.pattern_section ps
join catalog.exam_pattern ep on ep.pattern_id = ps.pattern_id;
