/**
 * core.educator_profile — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface EducatorProfileModel {
  user_id: string;
  specialisation: string | null;
  may_author: boolean;
  may_approve: boolean;
  assigned_subjects: unknown;
}
