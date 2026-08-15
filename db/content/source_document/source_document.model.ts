/**
 * content.source_document — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface SourceDocumentModel {
  document_id: string;
  subject_id: string;
  syllabus_version_id: string;
  title: string;
  document_type: string | null;
  publisher: string | null;
  edition_year: number | null;
  storage_uri: string | null;
  page_count: number | null;
  ingest_status: string;
}
