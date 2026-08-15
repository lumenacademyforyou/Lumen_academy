/**
 * catalog.exam_cycle — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface ExamCycleModel {
  cycle_id: string;
  exam_id: string;
  cycle_year: number;
  exam_date: string | null;
  registration_opens_on: string | null;
  cycle_status: string;
}
