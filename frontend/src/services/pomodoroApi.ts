import { apiFetch } from "./api";
import type { StudySession } from "./studySessionService";

// BUG-22 (docs/assessment-tool-debug-plan.md Phase 7) — a real, server-side
// pomodoro session log. Replaces studySessionService.ts's localStorage-only
// history, which was invisible to the demo-account reset and lost on device
// change. GET /learn/pomodoro-sessions already caps at the last 20 sessions
// server-side (learn.pomodoro_session.repository.ts's findRecentByUser).

export interface PomodoroSession {
  session_id: string;
  user_id: string;
  task_id: string | null;
  subject: string | null;
  task_title: string | null;
  session_type: "focus" | "shortBreak" | "longBreak";
  started_at: string;
  duration_seconds: number;
  is_completed: boolean;
  rating: number | null;
  notes: string | null;
  created_at: string;
}

/** @param limit defaults to 20 (the visible log's own size); pass a larger value (e.g. for a streak calculation) to see further back. */
export async function listMyPomodoroSessions(limit?: number): Promise<PomodoroSession[]> {
  const qs = limit ? `?limit=${limit}` : "";
  const res = await apiFetch<{ data: PomodoroSession[] }>(`/learn/pomodoro-sessions${qs}`);
  return res.data;
}

export async function createPomodoroSession(data: {
  subject: string;
  task_title: string;
  session_type: "focus" | "shortBreak" | "longBreak";
  started_at: string;
  duration_seconds: number;
  rating?: number;
  notes?: string;
}): Promise<PomodoroSession> {
  const res = await apiFetch<{ data: PomodoroSession }>("/learn/pomodoro-sessions", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function deletePomodoroSession(sessionId: string): Promise<void> {
  await apiFetch<void>(`/learn/pomodoro-sessions/${sessionId}`, { method: "DELETE" });
}

/**
 * Maps the server's pomodoro_session row shape onto the StudySession shape
 * studySessionService.ts's calculateStudyStreak/calculateSessionStats
 * already expect — those stay as pure functions over that shape; only the
 * fetch/save layer needed to move off localStorage (BUG-22).
 */
export function toStudySessions(sessions: PomodoroSession[]): StudySession[] {
  return sessions.map((s) => ({
    id: s.session_id,
    userId: s.user_id,
    studentName: "",
    subject: s.subject ?? "General",
    taskTitle: s.task_title ?? "",
    durationMinutes: Math.round(s.duration_seconds / 60),
    sessionType: s.session_type,
    completedAt: s.created_at,
    notes: s.notes ?? undefined,
    rating: s.rating ?? undefined,
  }));
}
