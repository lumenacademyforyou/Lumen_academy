/**
 * core.app_user — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface AppUserModel {
  user_id: string;
  institution_id: string | null;
  auth_user_id: string;
  email: string;
  mobile_number: string | null; // relaxed nullable by 007_core_mobile_nullable.sql — email-only signups have none
  full_name: string;
  user_role: string;
  preferred_language: string | null;
  status: string;
  last_login_at: string | null;
}
