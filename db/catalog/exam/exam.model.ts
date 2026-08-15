/**
 * catalog.exam — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface ExamModel {
  exam_id: string;
  exam_code: string;
  display_name: string;
  conducting_body: string | null;
  exam_level: string | null;
  supported_languages: unknown;
  is_active: boolean;
}
