/**
 * assess.attempt_event — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface AttemptEventModel {
  event_id: string;
  attempt_id: string;
  event_type: string;
  event_at: string | null;
  event_payload: unknown | null;
}
