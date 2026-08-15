-- 003_content.sql
-- Lumen Academy — content schema: 11 relations.
--
-- Sources: docs/db/SCHEMA_SPEC.md (keys, FK edge list),
-- docs/design/03_conceptual_er_low_level_revA.md (descriptive attribute names).
-- Depends on: 000_foundation.sql (vector extension), 001_catalog.sql
-- (subject/syllabus_version/syllabus_node), 002_core.sql (app_user).
--
-- IMPORTANT DISCREPANCY, flagging rather than silently picking a side:
-- docs/design/LA-ARC-002_content_storage.md and LA-ARC-003_vector_store_rag.md
-- describe content.question / content.source_document / content.document_chunk
-- with a DIFFERENT FK set than SCHEMA_SPEC.md (e.g. ARC-002 gives question an
-- exam_id FK instead of job_id; ARC-003 gives source_document an exam_id FK
-- instead of subject_id/syllabus_version_id, plus extra columns like sha256,
-- licence, approved_by that aren't in SCHEMA_SPEC's count at all). This
-- migration follows SCHEMA_SPEC.md's key structure throughout, per CLAUDE.md's
-- own instruction to start there for keys/FKs and use the low-level ER for
-- attribute names — the ARC docs are architecture narrative, not the key
-- source of truth, and the two genuinely disagree here. Revisit if that's wrong.
--
-- content.question_chunk_ref: SCHEMA_SPEC.md says "+2 descriptive attributes"
-- but no attribute names for this table appear anywhere in the design pack
-- (unlike every other table). Created with only its composite PK/FKs; the 2
-- unnamed columns are deliberately left out rather than invented — add them
-- in a follow-up migration once named.
--
-- content.document_chunk.chunk_seq and content.source_document's 7th
-- attribute (document_type): chunk_seq is required by SCHEMA_SPEC's AK but
-- isn't in the low-level ER's attribute list for DOCUMENT_CHUNK (same kind of
-- extraction gap as marking_scheme.scheme_code in 001_catalog.sql) — included
-- because the AK requires it. document_type is confirmed by the high-level ER's
-- description of SOURCE_DOCUMENT ("Approved PDF, book or past paper").
--
-- content.asset.question_id / document_id made NULLABLE (unlike this
-- migration's default of NOT NULL on unannotated FKs) — LA-ARC-002 describes
-- assets as extracted from a source document before any question references
-- them, so a hard NOT NULL on either would contradict the documented flow.
--
-- embedding uses vector(1024) per LA-ARC-003 ("1024-dim vector"); the HNSW
-- index on it is deliberately deferred to a later migration (006, per
-- SETUP.md's migration table) rather than added here.

-- ------------------------------------------------------- content.ai_generation_job
create table if not exists content.ai_generation_job (
  job_id            uuid primary key default gen_random_uuid(),
  requested_by      uuid not null,
  job_type          text not null,
  provider_name     text,
  model_name        text,
  prompt_version    text,
  input_tokens      integer,
  output_tokens     integer,
  cost_estimate     numeric,
  job_status        text not null,
  constraint fk_ai_generation_job_requested_by foreign key (requested_by) references core.app_user (user_id)
);

-- ---------------------------------------------------------- content.source_document
create table if not exists content.source_document (
  document_id            uuid primary key default gen_random_uuid(),
  subject_id             uuid not null,
  syllabus_version_id    uuid not null,
  title                  text not null,
  document_type          text,
  publisher              text,
  edition_year           smallint,
  storage_uri            text,
  page_count             integer,
  ingest_status          text not null,
  constraint fk_source_document_subject_id foreign key (subject_id) references catalog.subject (subject_id),
  constraint fk_source_document_syllabus_version_id foreign key (syllabus_version_id) references catalog.syllabus_version (syllabus_version_id)
);

-- ------------------------------------------------------------------- content.question
create table if not exists content.question (
  question_id          uuid primary key default gen_random_uuid(),
  question_uid         text not null,
  primary_node_id      uuid not null,
  job_id               uuid not null,
  question_type        text,
  difficulty_band      text,
  stem_text            text not null,
  numeric_answer       numeric,
  answer_tolerance     numeric,
  origin_year          smallint,
  usage_count          integer not null default 0,
  lifecycle_status     text not null,
  constraint fk_question_primary_node_id foreign key (primary_node_id) references catalog.syllabus_node (node_id),
  constraint fk_question_job_id foreign key (job_id) references content.ai_generation_job (job_id),
  constraint uq_question_question_uid unique (question_uid)
);

-- -------------------------------------------------------------- content.document_chunk
create table if not exists content.document_chunk (
  chunk_id            uuid primary key default gen_random_uuid(),
  document_id         uuid not null,
  chunk_seq           smallint not null,
  page_from           integer,
  page_to             integer,
  chunk_text          text not null,
  embedding           vector(1024),
  token_count         integer,
  content_checksum    bytea,
  constraint fk_document_chunk_document_id foreign key (document_id) references content.source_document (document_id),
  constraint uq_document_chunk_document_id_chunk_seq unique (document_id, chunk_seq)
);

-- ------------------------------------------------------------- content.question_option
create table if not exists content.question_option (
  option_id        uuid primary key default gen_random_uuid(),
  question_id      uuid not null,
  option_label     text not null,
  option_text      text not null,
  is_correct       boolean not null default false,
  display_order    smallint,
  constraint fk_question_option_question_id foreign key (question_id) references content.question (question_id),
  constraint uq_question_option_question_id_option_label unique (question_id, option_label)
);

-- ----------------------------------------------------------- content.question_solution
create table if not exists content.question_solution (
  solution_id                uuid primary key default gen_random_uuid(),
  question_id                uuid not null,
  explanation_text           text not null,
  step_sequence              jsonb,
  formula_reference          text,
  expected_solve_seconds     integer,
  constraint fk_question_solution_question_id foreign key (question_id) references content.question (question_id),
  constraint uq_question_solution_question_id unique (question_id)
);

-- -------------------------------------------------------- content.question_translation
create table if not exists content.question_translation (
  translation_id     uuid primary key default gen_random_uuid(),
  question_id        uuid not null,
  language_code      text not null,
  stem_text          text not null,
  option_texts       jsonb,
  translated_by      uuid,
  review_status      text not null,
  constraint fk_question_translation_question_id foreign key (question_id) references content.question (question_id),
  constraint uq_question_translation_question_id_language_code unique (question_id, language_code)
);

-- -------------------------------------------------------- content.question_node_map
create table if not exists content.question_node_map (
  question_id      uuid not null,
  node_id          uuid not null,
  relevance_rank   smallint,
  tagged_by        uuid,
  tagged_at        timestamptz,
  constraint pk_question_node_map primary key (question_id, node_id),
  constraint fk_question_node_map_question_id foreign key (question_id) references content.question (question_id),
  constraint fk_question_node_map_node_id foreign key (node_id) references catalog.syllabus_node (node_id)
);

-- ------------------------------------------------------- content.question_chunk_ref
-- 2 descriptive attributes named nowhere in the design pack — see file header.
create table if not exists content.question_chunk_ref (
  question_id   uuid not null,
  chunk_id      uuid not null,
  constraint pk_question_chunk_ref primary key (question_id, chunk_id),
  constraint fk_question_chunk_ref_question_id foreign key (question_id) references content.question (question_id),
  constraint fk_question_chunk_ref_chunk_id foreign key (chunk_id) references content.document_chunk (chunk_id)
);

-- ----------------------------------------------------------- content.question_review
create table if not exists content.question_review (
  review_id           uuid primary key default gen_random_uuid(),
  question_id         uuid not null,
  reviewer_user_id    uuid not null,
  job_id              uuid not null,
  reviewer_type       text,
  verdict             text not null,
  issue_codes         jsonb,
  reviewer_note       text,
  reviewed_at         timestamptz,
  constraint fk_question_review_question_id foreign key (question_id) references content.question (question_id),
  constraint fk_question_review_reviewer_user_id foreign key (reviewer_user_id) references core.app_user (user_id),
  constraint fk_question_review_job_id foreign key (job_id) references content.ai_generation_job (job_id)
);

-- ------------------------------------------------------------------------ content.asset
create table if not exists content.asset (
  asset_id        uuid primary key default gen_random_uuid(),
  question_id     uuid,
  document_id     uuid,
  asset_type      text not null,
  storage_uri     text not null,
  alt_text        text,
  render_hint     text,
  constraint fk_asset_question_id foreign key (question_id) references content.question (question_id),
  constraint fk_asset_document_id foreign key (document_id) references content.source_document (document_id)
);
