-- =====================================================================
-- 010_question_model.RECONSTRUCTED.sql
--
-- *** THIS IS NOT THE REAL SCHEMA FILE. ***
-- The actual 010_question_model.sql was referenced as a prerequisite by
-- every file in the authoring kit but was never included in what was
-- uploaded. This is a from-scratch reconstruction, built only from every
-- column and table name actually *used* across the seven
-- content/*.block-template.sql demo files, 000_template_helpers.sql,
-- and 012_question_variant.sql — plus my own design for the pieces
-- nothing ever demonstrated (marked INFERRED below). Its only purpose is
-- to give the importer something real to run against and be tested
-- against, so its logic (SQL correctness, transaction behavior, checksum
-- dedup, structural rejection) gets actual verification instead of just
-- another round of static file reads. Table/column names that WERE
-- directly confirmed by a real insert statement in the block-templates
-- are marked CONFIRMED. Replace this file with the real one before using
-- the importer against a production database — in particular, every
-- INFERRED piece (the question-to-concept tagging table, the eligibility
-- view, next_lumen_id's exact format, the numeric-answer storage still
-- flagged as OPEN ITEM 3 throughout this kit) needs to be checked against
-- whatever the real 010_question_model.sql actually says.
-- =====================================================================

create extension if not exists pgcrypto;  -- for gen_random_uuid()

create schema if not exists catalog;
create schema if not exists content;

-- ---------------------------------------------------------------------
-- catalog.subject -- CONFIRMED (insert seen in every concept-tree file)
-- ---------------------------------------------------------------------
create table catalog.subject (
  subject_id    uuid primary key default gen_random_uuid(),
  subject_code  text not null unique,
  subject_name  text not null,
  discipline    text not null
);

-- ---------------------------------------------------------------------
-- catalog.concept_node -- CONFIRMED (columns per upsert_concept())
-- ---------------------------------------------------------------------
create table catalog.concept_node (
  concept_id    uuid primary key default gen_random_uuid(),
  subject_id    uuid not null references catalog.subject(subject_id),
  parent_id     uuid references catalog.concept_node(concept_id),
  concept_code  text not null,
  concept_name  text not null,
  concept_path  text not null,
  depth         smallint not null,
  is_taggable   boolean not null default false,
  sort_order    smallint not null default 0,
  unique (subject_id, concept_path)
);

-- ---------------------------------------------------------------------
-- catalog.exam_family / catalog.exam -- CONFIRMED
-- ---------------------------------------------------------------------
create table catalog.exam_family (
  family_id    uuid primary key default gen_random_uuid(),
  family_code  text not null unique,
  family_name  text not null
);

create table catalog.exam (
  exam_id               uuid primary key default gen_random_uuid(),
  family_id             uuid not null references catalog.exam_family(family_id),
  exam_code             text not null unique,
  exam_name             text not null,
  exam_level            text not null,
  conducting_body       text not null,
  default_language      text not null,
  supported_languages   text[] not null
);

-- ---------------------------------------------------------------------
-- catalog.exam_subject / catalog.exam_subject_format -- CONFIRMED
-- ---------------------------------------------------------------------
create table catalog.exam_subject (
  exam_subject_id   uuid primary key default gen_random_uuid(),
  exam_id           uuid not null references catalog.exam(exam_id),
  subject_id        uuid not null references catalog.subject(subject_id),
  display_label     text not null,
  question_count    smallint,
  total_marks       smallint,
  duration_minutes  smallint,
  sort_order        smallint not null default 0,
  unique (exam_id, subject_id)
);

create table catalog.exam_subject_format (
  exam_subject_format_id     uuid primary key default gen_random_uuid(),
  exam_subject_id            uuid not null references catalog.exam_subject(exam_subject_id),
  section_code               text not null,
  question_format            text not null,   -- MCQ_SINGLE | MCQ_MULTIPLE | NUMERICAL | MATCHING_LIST
  question_count             smallint not null,
  attempt_count               smallint,
  full_marks                 numeric not null,
  negative_marks              numeric not null,
  unattempted_marks          numeric not null default 0,
  partial_scheme              text not null default 'NONE',
  partial_marks_per_correct   numeric,
  sort_order                 smallint not null default 0,
  unique (exam_subject_id, section_code, question_format)
);

-- ---------------------------------------------------------------------
-- catalog.node_level -- CONFIRMED
-- ---------------------------------------------------------------------
create table catalog.node_level (
  exam_id     uuid not null references catalog.exam(exam_id),
  level_no    smallint not null,
  level_code  text not null,
  level_label text not null,
  is_taggable boolean not null,
  primary key (exam_id, level_no)
);

-- ---------------------------------------------------------------------
-- catalog.syllabus_version / catalog.syllabus_node / syllabus_node_concept
-- -- CONFIRMED (columns per upsert_syllabus_node() / map_node_concept())
-- ---------------------------------------------------------------------
create table catalog.syllabus_version (
  syllabus_version_id  uuid primary key default gen_random_uuid(),
  exam_subject_id       uuid not null references catalog.exam_subject(exam_subject_id),
  version_code          text not null,
  effective_from        date not null,
  version_status        text not null,
  unique (exam_subject_id, version_code)
);

create table catalog.syllabus_node (
  node_id               uuid primary key default gen_random_uuid(),
  syllabus_version_id    uuid not null references catalog.syllabus_version(syllabus_version_id),
  parent_node_id         uuid references catalog.syllabus_node(node_id),
  node_code              text not null,
  node_name              text not null,
  node_path              text not null,
  level_no               smallint not null,
  node_type              text not null,
  sort_order             smallint not null default 0,
  weightage_pct          numeric,
  unique (syllabus_version_id, node_path)
);

create table catalog.syllabus_node_concept (
  node_id     uuid not null references catalog.syllabus_node(node_id),
  concept_id  uuid not null references catalog.concept_node(concept_id),
  coverage    text not null default 'full',
  primary key (node_id, concept_id)
);

-- ---------------------------------------------------------------------
-- content.question -- PARTIALLY CONFIRMED. The block-template demo
-- inserts only ever set question_id/lumen_id/subject_id/base_format/
-- cognitive_skill/base_difficulty/review_status. Every other column
-- below (is_numerical, concept_count, source*, author_id, is_active) is
-- INFERRED from what generate-questions.ts's output needs somewhere to
-- land -- confirm against the real file.
-- ---------------------------------------------------------------------
create table content.question (
  question_id               uuid primary key default gen_random_uuid(),
  lumen_id                  text not null unique,
  subject_id                uuid not null references catalog.subject(subject_id),
  base_format                text not null,   -- MCQ_SINGLE | MCQ_MULTIPLE | NUMERICAL | MATCHING_LIST
  cognitive_skill            text not null,
  base_difficulty            text not null,   -- L1..L5
  review_status              text not null default 'DRAFT',  -- INFERRED enum, see PROMPT_TEMPLATE.md
  representation_types       text[] not null default '{}',    -- INFERRED: trigger-maintained, not hand-set
  is_numerical               boolean not null default false,  -- INFERRED
  concept_count              smallint not null default 1,     -- INFERRED
  source                     text,                             -- INFERRED
  source_reference           text,                             -- INFERRED
  author_id                  uuid,                             -- INFERRED, OPEN ITEM 4
  is_active                  boolean not null default false,   -- INFERRED
  created_at                 timestamptz not null default now()
  -- variant_of_question_id / variant_reason / variant constraints are
  -- NOT created here: they are added by the real 012_question_variant.sql
  -- (present in the uploaded kit) via ALTER TABLE. Run that file
  -- immediately after this one. Baking them into the CREATE TABLE here
  -- would make 012_question_variant.sql fail with "column already
  -- exists" when run against this reconstruction.
);

-- INFERRED -- OPEN ITEM 1. The tagging bridge between a question and the
-- concept(s) it covers. Every coverage/eligibility view in this kit
-- needs a table like this to exist; its real name/shape is unconfirmed.
create table content.question_concept (
  question_id  uuid not null references content.question(question_id),
  concept_id   uuid not null references catalog.concept_node(concept_id),
  is_primary   boolean not null default true,
  primary key (question_id, concept_id)
);

-- ---------------------------------------------------------------------
-- content.question_option -- CONFIRMED
-- ---------------------------------------------------------------------
create table content.question_option (
  option_id      uuid primary key default gen_random_uuid(),
  question_id    uuid not null references content.question(question_id),
  option_label   text not null,
  is_correct     boolean not null,
  display_order  smallint not null
);

-- ---------------------------------------------------------------------
-- content.asset / content.equation / content.equation_variable /
-- content.data_table -- CONFIRMED (columns per the block-template demos)
-- ---------------------------------------------------------------------
create table content.asset (
  asset_id          uuid primary key default gen_random_uuid(),
  asset_kind        text not null,   -- GRAPH | CIRCUIT | IMAGE | DIAGRAM | ...
  storage_uri       text not null,
  mime_type         text not null,
  byte_size         integer,          -- CONFIRMED column (image.block-template.sql); nullable since circuit/graph demos omit it
  width_px          integer,
  height_px         integer,
  checksum_sha256   text not null unique   -- INFERRED unique constraint, needed for the dedup the delivery plan calls for
);

create table content.equation (
  equation_id     uuid primary key default gen_random_uuid(),
  latex_source    text not null,
  display_mode    text not null,   -- DISPLAY | INLINE (INLINE inferred, DISPLAY confirmed)
  equation_name   text not null
);

create table content.equation_variable (
  equation_id  uuid not null references content.equation(equation_id),
  symbol       text not null,
  meaning      text not null,
  si_unit      text,
  sort_order   smallint not null default 0
);

create table content.data_table (
  table_id      uuid primary key default gen_random_uuid(),
  table_kind    text not null,   -- TABLE | MATCHING_GRID | DATASET
  caption       text,
  column_defs   jsonb not null,
  row_data      jsonb not null,
  units         jsonb
);

-- ---------------------------------------------------------------------
-- content.content_block -- CONFIRMED (columns per every block-template demo)
-- ---------------------------------------------------------------------
create table content.content_block (
  block_id        uuid primary key default gen_random_uuid(),
  question_id     uuid references content.question(question_id),
  option_id       uuid references content.question_option(option_id),
  block_role      text not null,   -- STEM | OPTION | EXPLANATION (EXPLANATION is INFERRED -- OPEN ITEM 2)
  seq             smallint not null,
  block_type      text not null,   -- TEXT | LATEX | EQUATION | TABLE | DATASET | IMAGE | DIAGRAM | GRAPH | CIRCUIT | ...
  text_content    text,
  text_format     text,            -- PLAIN | MARKDOWN | HTML | LATEX
  asset_id        uuid references content.asset(asset_id),
  alt_text        text,
  caption         text,
  table_id        uuid references content.data_table(table_id),
  equation_id     uuid references content.equation(equation_id),
  language_code   text not null default 'en',
  constraint ck_content_block_parent check (
    (question_id is not null and option_id is null) or
    (question_id is null and option_id is not null)
  ),
  -- CONFIRMED by image.block-template.sql's own comment: "alt_text is
  -- compulsory and is enforced by constraint: a visual with no alt text
  -- is a visual a student on a slow connection or a screen reader cannot
  -- use." The exact list of which block_types count as "visual" is
  -- INFERRED (every asset-backed figure type; TABLE/DATASET/EQUATION use
  -- caption instead and are exempt).
  constraint ck_content_block_visual_alt_text check (
    block_type not in ('IMAGE','DIAGRAM','GRAPH','CIRCUIT','CHEMICAL_STRUCTURE',
                        'REACTION_SCHEME','EXPERIMENTAL_SETUP','GEOMETRY_FIGURE',
                        'COORDINATE_FIGURE','LABELLED_DIAGRAM','BIOLOGICAL_STRUCTURE')
    or alt_text is not null
  )
);

-- ---------------------------------------------------------------------
-- content.next_lumen_id -- INFERRED. Format taken from the one example
-- LA-DBM-002-content-storage-howto.md gives ("LMN-PHY-CURELE-000001").
-- ---------------------------------------------------------------------
create sequence content.lumen_id_seq;

create or replace function content.next_lumen_id(p_subject text, p_topic_code text)
returns text
language sql
as $$
  select 'LMN-' || p_subject || '-' || p_topic_code || '-' ||
         lpad(nextval('content.lumen_id_seq')::text, 6, '0');
$$;

-- ---------------------------------------------------------------------
-- content.v_question_eligibility -- INFERRED. The delivery plan's own
-- gate query ("select count(*) from content.v_question_eligibility
-- where exam_code = 'NEET-UG'") only makes sense if this view joins a
-- question, through its tagged concept(s), through the syllabus bridge,
-- to every exam that can reach it -- and only counts questions actually
-- fit to serve (approved + active). Confirm the real filter conditions
-- against 010_question_model.sql; this is a reasonable guess, not a fact.
-- ---------------------------------------------------------------------
create or replace view content.v_question_eligibility as
select distinct
       q.question_id,
       q.lumen_id,
       e.exam_code,
       s.subject_code
  from content.question q
  join content.question_concept qc on qc.question_id = q.question_id
  join catalog.concept_node cn     on cn.concept_id = qc.concept_id
  join catalog.subject s           on s.subject_id = cn.subject_id
  join catalog.syllabus_node_concept snc on snc.concept_id = cn.concept_id
  join catalog.syllabus_node sn    on sn.node_id = snc.node_id
  join catalog.syllabus_version sv on sv.syllabus_version_id = sn.syllabus_version_id
  join catalog.exam_subject es     on es.exam_subject_id = sv.exam_subject_id
  join catalog.exam e              on e.exam_id = es.exam_id
 where q.review_status = 'APPROVED'
   and q.is_active = true;

comment on view content.v_question_eligibility is
  'INFERRED view, not confirmed against the real schema. Every question reachable by every exam whose syllabus maps to one of its tagged concepts, restricted to approved+active questions.';
