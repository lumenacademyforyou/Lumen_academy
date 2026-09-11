import { apiFetch } from "./api";

// BUG-19 (docs/assessment-tool-debug-plan.md Phase 7) — real, server-backed
// "create once, edit anytime" study plan. Replaces StudyPlanView.tsx's
// handleSavePlan, which previously only flipped a local "savedSuccess"
// boolean for 3 seconds and never called any API.

export interface StudyPlan {
  plan_id: string;
  user_id: string;
  cycle_id: string;
  plan_title: string;
  plan_status: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface StudyPlanGoal {
  goal_id: string;
  plan_id: string;
  subject: string;
  chapter: string;
  high_yield_tag: string | null;
  hours_needed: number | null;
  is_completed: boolean;
  sort_order: number;
}

export async function getMyStudyPlan(): Promise<StudyPlan | null> {
  const res = await apiFetch<{ data: StudyPlan | null }>("/learn/study-plans/me");
  return res.data;
}

/** Creates the plan on first save; every later call updates the same one (create-once, edit-anytime). */
export async function saveMyStudyPlan(config: Record<string, unknown>): Promise<StudyPlan> {
  const res = await apiFetch<{ data: StudyPlan }>("/learn/study-plans/me", {
    method: "POST",
    body: JSON.stringify({ config }),
  });
  return res.data;
}

/** Archives the current plan and starts a fresh one with the default goal checklist. */
export async function resetMyStudyPlan(config: Record<string, unknown>): Promise<StudyPlan> {
  const res = await apiFetch<{ data: StudyPlan }>("/learn/study-plans/reset", {
    method: "POST",
    body: JSON.stringify({ config }),
  });
  return res.data;
}

export async function listStudyPlanGoals(planId: string): Promise<StudyPlanGoal[]> {
  const res = await apiFetch<{ data: StudyPlanGoal[] }>(`/learn/study-plans/${planId}/goals`);
  return res.data;
}

export async function addStudyPlanGoal(
  planId: string,
  data: { subject: string; chapter: string; high_yield_tag?: string; hours_needed?: number }
): Promise<StudyPlanGoal> {
  const res = await apiFetch<{ data: StudyPlanGoal }>(`/learn/study-plans/${planId}/goals`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateStudyPlanGoal(
  planId: string,
  goalId: string,
  data: Partial<Pick<StudyPlanGoal, "is_completed" | "subject" | "chapter" | "high_yield_tag" | "hours_needed">>
): Promise<StudyPlanGoal> {
  const res = await apiFetch<{ data: StudyPlanGoal }>(`/learn/study-plans/${planId}/goals/${goalId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteStudyPlanGoal(planId: string, goalId: string): Promise<void> {
  await apiFetch<void>(`/learn/study-plans/${planId}/goals/${goalId}`, { method: "DELETE" });
}

export async function reorderStudyPlanGoals(planId: string, goalIds: string[]): Promise<StudyPlanGoal[]> {
  const res = await apiFetch<{ data: StudyPlanGoal[] }>(`/learn/study-plans/${planId}/goals/order`, {
    method: "PUT",
    body: JSON.stringify({ goalIds }),
  });
  return res.data;
}
