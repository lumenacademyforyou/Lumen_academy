/**
 * learn.study_plan — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface StudyPlanModel {
  plan_id: string;
  user_id: string;
  cycle_id: string;
  plan_title: string;
  target_exam_date: string | null;
  daily_minutes: number | null;
  start_date: string | null;
  plan_strategy: string | null;
  plan_status: string;
}
