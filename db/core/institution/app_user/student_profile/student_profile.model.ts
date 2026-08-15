/**
 * core.student_profile — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface StudentProfileModel {
  user_id: string;
  target_year: number | null;
  class_level: string | null;
  guardian_contact: string | null;
  daily_study_minutes: number | null;
  onboarding_state: string | null;
}
