/**
 * learn.plan_task — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface PlanTaskModel {
  task_id: string;
  plan_id: string;
  node_id: string;
  scheduled_date: string | null;
  activity_type: string | null;
  planned_minutes: number | null;
  task_status: string;
  completed_at: string | null;
}
