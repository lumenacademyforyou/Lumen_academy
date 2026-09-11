-- verify_006_pgvector_index.sql
-- Asserts the HNSW index and TOAST storage setting from
-- db/migrations/006_pgvector_index.sql exist. A migration is not done until
-- this passes (CLAUDE.md migration rule 3).

do $$
declare
  missing text[] := array[]::text[];
  storage_mode "char";
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'content'
      and tablename = 'document_chunk'
      and indexname = 'hnsw_document_chunk_embedding'
  ) then
    missing := array_append(missing, 'index:content.hnsw_document_chunk_embedding');
  end if;

  select attstorage into storage_mode
  from pg_attribute
  where attrelid = 'content.document_chunk'::regclass
    and attname = 'chunk_text';

  if storage_mode is distinct from 'x' then
    missing := array_append(missing, 'storage:content.document_chunk.chunk_text (expected extended)');
  end if;

  if array_length(missing, 1) is not null then
    raise exception 'verify_006_pgvector_index FAILED — missing: %', array_to_string(missing, ', ');
  end if;

  raise notice 'verify_006_pgvector_index: OK — HNSW index present, chunk_text storage extended';
end $$;
