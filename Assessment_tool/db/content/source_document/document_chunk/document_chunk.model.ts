/**
 * content.document_chunk — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface DocumentChunkModel {
  chunk_id: string;
  document_id: string;
  chunk_seq: number;
  page_from: number | null;
  page_to: number | null;
  chunk_text: string;
  embedding: number[] | null;
  token_count: number | null;
  content_checksum: Buffer | null;
}
