/**
 * assess.attempt — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface AttemptModel {
  attempt_id: string;
  test_id: string;
  user_id: string;
  assignment_id: string | null;
  attempt_no: number;
  started_at: string | null;
  server_deadline: string | null;
  submitted_at: string | null;
  elapsed_seconds: number | null;
  attempt_state: string;
  device_fingerprint: string | null;
  sync_state: string | null;
}
