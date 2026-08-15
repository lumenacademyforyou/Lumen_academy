/**
 * learn.error_log — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface ErrorLogModel {
  error_log_id: string;
  user_id: string;
  response_id: string;
  node_id: string;
  error_type: string;
  learner_note: string | null;
  is_resolved: boolean;
  logged_at: string | null;
}
