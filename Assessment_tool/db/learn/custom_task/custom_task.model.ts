/**
 * learn.custom_task — model (026_learn_study_tools.sql)
 *
 * BUG-20 — a lightweight, ad-hoc task list independent of the structured
 * study plan (no plan_id/node_id dependency).
 */
export interface CustomTaskModel {
  task_id: string;
  user_id: string;
  title: string;
  subject: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}
