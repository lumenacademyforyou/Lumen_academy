/**
 * learn.study_session — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface StudySessionModel {
  session_id: string;
  task_id: string;
  user_id: string;
  started_at: string | null;
  ended_at: string | null;
  focus_minutes: number | null;
  capture_source: string | null;
}
