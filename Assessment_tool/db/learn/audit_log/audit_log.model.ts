/**
 * learn.audit_log — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface AuditLogModel {
  audit_id: string;
  actor_user_id: string | null;
  actor_type: string | null;
  action_name: string;
  entity_name: string;
  entity_key: string | null;
  change_payload: unknown | null;
  occurred_at: string | null;
}
