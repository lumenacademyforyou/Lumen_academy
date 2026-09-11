/**
 * assess.section_score — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface SectionScoreModel {
  section_score_id: string;
  scorecard_id: string;
  test_section_id: string;
  obtained_marks: number | null;
  attempted_count: number | null;
  correct_count: number | null;
  average_time_seconds: number | null;
}
