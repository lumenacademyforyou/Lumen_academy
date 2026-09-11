-- 001_catalog.sql
-- Lumen Academy — catalog schema: 9 relations.
--
-- Sources: docs/db/SCHEMA_SPEC.md (keys, FK edge list),
-- docs/design/03_conceptual_er_low_level_revA.md (descriptive attribute names).
-- Depends on: 000_foundation.sql (schema + pgcrypto/pgvector/pg_trgm/pg_partman).
--
-- NOTE on marking_scheme.scheme_code: SCHEMA_SPEC.md lists it as an AK, but the
-- low-level ER's extracted attribute list for MARKING_SCHEME does not show it
-- (likely lost at an SVG column boundary during extraction). Included because
-- SCHEMA_SPEC.md is authoritative for key structure — flag if that's wrong.
--
-- NOTE on column types: the design pack names columns but not SQL types (that's
-- a physical-design decision, not given anywhere in the pack). Types below are a
-- reasonable, uninvented-in-substance default: uuid surrogate PKs (rule R6/R7),
-- text for codes/names/free text, smallint for small counts/years/sequence
-- numbers, numeric for marks, date for calendar dates, jsonb for the one
-- explicitly multi-valued attribute (supported_languages, per mapping rule R8 —
-- "never a comma-separated string").
--
-- NOTE: no table in this schema carries created_at/updated_at in the low-level
-- ER's attribute list (unlike core.institution, which does) — not added here
-- since that would be inventing a column beyond what's specified.

-- ---------------------------------------------------------------- catalog.exam
create table if not exists catalog.exam (
  exam_id              uuid primary key default gen_random_uuid(),
  exam_code            text not null,
  display_name         text not null,
  conducting_body      text,
  exam_level           text,
  supported_languages  jsonb not null default '[]'::jsonb,
  is_active            boolean not null default true,
  constraint uq_exam_exam_code unique (exam_code)
);

-- ------------------------------------------------------ catalog.marking_scheme
create table if not exists catalog.marking_scheme (
  scheme_id               uuid primary key default gen_random_uuid(),
  scheme_code             text not null,
  correct_marks           numeric not null,
  incorrect_marks         numeric not null,
  unattempted_marks       numeric not null default 0,
  partial_credit_rule     text,
  numeric_tolerance_pct   numeric,
  constraint uq_marking_scheme_scheme_code unique (scheme_code)
);

-- ---------------------------------------------------------- catalog.exam_cycle
create table if not exists catalog.exam_cycle (
  cycle_id                  uuid primary key default gen_random_uuid(),
  exam_id                   uuid not null,
  cycle_year                smallint not null,
  exam_date                 date,
  registration_opens_on     date,
  cycle_status              text not null,
  constraint fk_exam_cycle_exam_id foreign key (exam_id) references catalog.exam (exam_id),
  constraint uq_exam_cycle_exam_id_cycle_year unique (exam_id, cycle_year)
);

-- -------------------------------------------------------------- catalog.subject
create table if not exists catalog.subject (
  subject_id      uuid primary key default gen_random_uuid(),
  exam_id         uuid not null,
  subject_code    text not null,
  subject_name    text not null,
  stream          text,
  display_order   smallint,
  colour_key      text,
  constraint fk_subject_exam_id foreign key (exam_id) references catalog.exam (exam_id),
  constraint uq_subject_exam_id_subject_code unique (exam_id, subject_code)
);

-- ------------------------------------------------------ catalog.syllabus_version
create table if not exists catalog.syllabus_version (
  syllabus_version_id   uuid primary key default gen_random_uuid(),
  exam_id               uuid not null,
  board_name            text,
  effective_year        smallint,
  source_workbook       text,
  version_status        text not null,
  constraint fk_syllabus_version_exam_id foreign key (exam_id) references catalog.exam (exam_id)
);

-- --------------------------------------------------------- catalog.exam_pattern
create table if not exists catalog.exam_pattern (
  pattern_id         uuid primary key default gen_random_uuid(),
  cycle_id           uuid not null,
  scheme_id          uuid not null,
  version_no         smallint not null,
  effective_from     date,
  total_questions    smallint not null,
  total_marks        numeric not null,
  duration_minutes   smallint not null,
  is_current         boolean not null default false,
  constraint fk_exam_pattern_cycle_id foreign key (cycle_id) references catalog.exam_cycle (cycle_id),
  constraint fk_exam_pattern_scheme_id foreign key (scheme_id) references catalog.marking_scheme (scheme_id),
  constraint uq_exam_pattern_cycle_id_version_no unique (cycle_id, version_no)
);

-- ------------------------------------------------------- catalog.pattern_section
create table if not exists catalog.pattern_section (
  pattern_section_id   uuid primary key default gen_random_uuid(),
  pattern_id           uuid not null,
  subject_id           uuid not null,
  scheme_id            uuid not null,
  section_name         text not null,
  sequence_no          smallint not null,
  question_count       smallint not null,
  optional_count       smallint not null default 0,
  section_time_limit   smallint,
  constraint fk_pattern_section_pattern_id foreign key (pattern_id) references catalog.exam_pattern (pattern_id),
  constraint fk_pattern_section_subject_id foreign key (subject_id) references catalog.subject (subject_id),
  constraint fk_pattern_section_scheme_id foreign key (scheme_id) references catalog.marking_scheme (scheme_id),
  constraint uq_pattern_section_pattern_id_sequence_no unique (pattern_id, sequence_no)
);

-- --------------------------------------------------------- catalog.syllabus_node
create table if not exists catalog.syllabus_node (
  node_id                uuid primary key default gen_random_uuid(),
  syllabus_version_id    uuid not null,
  subject_id             uuid not null,
  parent_node_id         uuid,
  tag_code               text not null,
  node_type              text not null,
  title                  text not null,
  class_level            text,
  depth                  smallint not null default 0,
  display_order          smallint,
  constraint fk_syllabus_node_syllabus_version_id foreign key (syllabus_version_id) references catalog.syllabus_version (syllabus_version_id),
  constraint fk_syllabus_node_subject_id foreign key (subject_id) references catalog.subject (subject_id),
  constraint fk_syllabus_node_parent_node_id foreign key (parent_node_id) references catalog.syllabus_node (node_id),
  constraint uq_syllabus_node_version_tag unique (syllabus_version_id, tag_code),
  -- Direct self-parenting caught here. Full multi-level ancestor-cycle
  -- prevention ("a syllabus node may not be its own ancestor", per
  -- docs/design/04_logical_relational_schema.md) needs a trigger walking
  -- parent_node_id — not added here since the design pack states the rule but
  -- doesn't specify the enforcement mechanism; flag before assuming this is enough.
  constraint ck_syllabus_node_not_self_parent check (parent_node_id is null or parent_node_id <> node_id)
);

-- ------------------------------------------------------ catalog.node_weightage
create table if not exists catalog.node_weightage (
  weightage_id         uuid primary key default gen_random_uuid(),
  pattern_id           uuid not null,
  node_id              uuid not null,
  weight_marks         numeric,
  expected_questions   smallint,
  priority_rank        smallint,
  constraint fk_node_weightage_pattern_id foreign key (pattern_id) references catalog.exam_pattern (pattern_id),
  constraint fk_node_weightage_node_id foreign key (node_id) references catalog.syllabus_node (node_id),
  constraint uq_node_weightage_pattern_id_node_id unique (pattern_id, node_id)
);
