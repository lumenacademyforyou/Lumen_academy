/**
 * learn.pomodoro_session — model (026_learn_study_tools.sql)
 *
 * BUG-22 — a real, server-side pomodoro session log, replacing what was
 * previously localStorage-only (invisible to the demo-account reset, lost
 * on device change).
 */
export interface PomodoroSessionModel {
  session_id: string;
  user_id: string;
  task_id: string | null;
  /** Free-text subject label (e.g. "Physics") — independent of any catalog subject id, matching the timer's own subject picker. */
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
