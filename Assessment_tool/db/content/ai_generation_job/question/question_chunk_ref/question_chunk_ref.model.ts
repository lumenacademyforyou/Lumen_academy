/**
 * content.question_chunk_ref — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface QuestionChunkRefModel {
  question_id: string;
  chunk_id: string;
}
