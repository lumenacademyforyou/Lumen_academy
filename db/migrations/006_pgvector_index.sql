-- 006_pgvector_index.sql
-- Lumen Academy — HNSW index on content.document_chunk.embedding.
--
-- Source: docs/design/LA-ARC-003_vector_store_rag.md ("INDEX AND STORAGE
-- SETTINGS"). That doc's SQL block also creates:
--   CREATE INDEX ON content.document_chunk (exam_id, node_id) WHERE embedding IS NOT NULL;
-- and sets `hnsw.ef_search = 40`. Both skipped here:
--   - exam_id/node_id don't exist on content.document_chunk as built in
--     003_content.sql (that ARC-003 SQL assumes the different FK shape
--     flagged as a discrepancy there) — can't index columns that don't exist.
--   - hnsw.ef_search is a per-session runtime parameter (SET, not part of any
--     persisted object), not something a migration can meaningfully apply —
--     it belongs in the connection/pool setup on the application side.
-- Depends on: 000_foundation.sql (vector extension), 003_content.sql
-- (content.document_chunk.embedding column).

create index if not exists hnsw_document_chunk_embedding
  on content.document_chunk
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- TOAST chunk_text out-of-line always, per LA-ARC-003 ("ALTER TABLE … ALTER
-- COLUMN chunk_text SET STORAGE EXTENDED"). Only affects storage of rows
-- written/rewritten after this point, not existing rows in place.
alter table content.document_chunk
  alter column chunk_text set storage extended;
