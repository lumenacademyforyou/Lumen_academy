/**
 * catalog.subject — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface SubjectModel {
  subject_id: string;
  exam_id: string;
  subject_code: string;
  subject_name: string;
  stream: string | null;
  display_order: number | null;
  colour_key: string | null;
}
