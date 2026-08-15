/**
 * catalog.syllabus_version — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface SyllabusVersionModel {
  syllabus_version_id: string;
  exam_id: string;
  board_name: string | null;
  effective_year: number | null;
  source_workbook: string | null;
  version_status: string;
}
