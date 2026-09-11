/**
 * core.institution — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface InstitutionModel {
  institution_id: string;
  institution_code: string;
  name: string;
  institution_type: string | null;
  default_locale: string | null;
  status: string;
  created_at: string;
}
