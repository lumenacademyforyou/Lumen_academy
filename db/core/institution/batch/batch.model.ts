/**
 * core.batch — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface BatchModel {
  batch_id: string;
  institution_id: string;
  cycle_id: string;
  batch_code: string;
  batch_name: string;
  academic_year: string | null;
  start_date: string | null;
  end_date: string | null;
}
