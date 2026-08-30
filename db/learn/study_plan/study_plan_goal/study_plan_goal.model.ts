/**
 * learn.study_plan_goal — model (026_learn_study_tools.sql)
 *
 * BUG-19's "items" — StudyPlanView.tsx's ChapterGoal checklist, one row per
 * chapter goal, ordered by sort_order within a plan.
 */
export interface StudyPlanGoalModel {
  goal_id: string;
  plan_id: string;
  subject: string;
  chapter: string;
  high_yield_tag: string | null;
  hours_needed: number | null;
  is_completed: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
