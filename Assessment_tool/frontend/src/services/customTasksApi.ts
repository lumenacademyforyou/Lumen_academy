import { apiFetch } from "./api";

// BUG-20 (docs/assessment-tool-debug-plan.md Phase 7) — real server-side
// persistence for StudyPlanView.tsx's "My Custom Study Tasks" panel.
// Replaces frontend/src/services/supabase.ts's fetchUserTasks/saveUserTask/
// deleteUserTask, which pointed at a Supabase table (`user_tasks`) that was
// never migrated and silently failed every call.

export interface CustomTask {
  task_id: string;
  user_id: string;
  title: string;
  subject: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function listMyCustomTasks(): Promise<CustomTask[]> {
  const res = await apiFetch<{ data: CustomTask[] }>("/learn/custom-tasks");
  return res.data;
}

export async function createCustomTask(data: { title: string; subject?: string }): Promise<CustomTask> {
  const res = await apiFetch<{ data: CustomTask }>("/learn/custom-tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateCustomTask(
  taskId: string,
  data: Partial<Pick<CustomTask, "title" | "subject" | "is_completed">>
): Promise<CustomTask> {
  const res = await apiFetch<{ data: CustomTask }>(`/learn/custom-tasks/${taskId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deleteCustomTask(taskId: string): Promise<void> {
  await apiFetch<void>(`/learn/custom-tasks/${taskId}`, { method: "DELETE" });
}
