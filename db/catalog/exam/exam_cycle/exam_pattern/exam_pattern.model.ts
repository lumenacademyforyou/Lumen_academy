/**
 * catalog.exam_pattern — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface ExamPatternModel {
  pattern_id: string;
  cycle_id: string;
  scheme_id: string;
  version_no: number;
  effective_from: string | null;
  total_questions: number;
  total_marks: number;
  duration_minutes: number;
  is_current: boolean;
}
