/**
 * assess.scorecard — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface ScorecardModel {
  scorecard_id: string;
  attempt_id: string;
  obtained_marks: number | null;
  total_marks: number | null;
  accuracy_percent: number | null;
  percentile: number | null;
  rank_in_cohort: number | null;
  generated_at: string | null;
}
