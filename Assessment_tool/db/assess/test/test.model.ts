/**
 * assess.test — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface TestModel {
  test_id: string;
  test_code: string;
  pattern_id: string;
  cycle_id: string;
  created_by: string;
  title: string;
  test_mode: string | null;
  language_set: unknown;
  total_marks: number | null;
  duration_minutes: number | null;
  window_opens_at: string | null;
  window_closes_at: string | null;
  test_status: string;
}
