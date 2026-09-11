-- verify_003_content.sql
-- Asserts every table and constraint created by db/migrations/003_content.sql
-- exists. A migration is not done until this passes (CLAUDE.md migration rule 3).

do $$
declare
  missing text[] := array[]::text[];
  t text;
  c text;
begin
  foreach t in array array[
    'ai_generation_job', 'source_document', 'question', 'document_chunk',
    'question_option', 'question_solution', 'question_translation',
    'question_node_map', 'question_chunk_ref', 'question_review', 'asset'
  ] loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'content' and table_name = t
    ) then
      missing := array_append(missing, 'table:content.' || t);
    end if;
  end loop;

  foreach c in array array[
    'ai_generation_job_pkey', 'fk_ai_generation_job_requested_by',
    'source_document_pkey', 'fk_source_document_subject_id', 'fk_source_document_syllabus_version_id',
    'question_pkey', 'fk_question_primary_node_id', 'fk_question_job_id', 'uq_question_question_uid',
    'document_chunk_pkey', 'fk_document_chunk_document_id', 'uq_document_chunk_document_id_chunk_seq',
    'question_option_pkey', 'fk_question_option_question_id', 'uq_question_option_question_id_option_label',
    'question_solution_pkey', 'fk_question_solution_question_id', 'uq_question_solution_question_id',
    'question_translation_pkey', 'fk_question_translation_question_id', 'uq_question_translation_question_id_language_code',
    'pk_question_node_map', 'fk_question_node_map_question_id', 'fk_question_node_map_node_id',
    'pk_question_chunk_ref', 'fk_question_chunk_ref_question_id', 'fk_question_chunk_ref_chunk_id',
    'question_review_pkey', 'fk_question_review_question_id', 'fk_question_review_reviewer_user_id', 'fk_question_review_job_id',
    'asset_pkey', 'fk_asset_question_id', 'fk_asset_document_id'
  ] loop
    if not exists (
      select 1 from pg_constraint con
      join pg_namespace n on n.oid = con.connamespace
      where n.nspname = 'content' and con.conname = c
    ) then
      missing := array_append(missing, 'constraint:content.' || c);
    end if;
  end loop;

  if array_length(missing, 1) is not null then
    raise exception 'verify_003_content FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_003_content: OK — 11 tables, 33 constraints present';
end $$;
