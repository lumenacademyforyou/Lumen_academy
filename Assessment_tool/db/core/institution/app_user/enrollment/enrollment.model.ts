/**
 * core.enrollment — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface EnrollmentModel {
  enrollment_id: string;
  user_id: string;
  cycle_id: string;
  enrolled_on: string | null;
  target_score: number | null;
  preferred_language: string | null;
  enrollment_status: string;
}
