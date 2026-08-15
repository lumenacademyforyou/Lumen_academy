/**
 * learn.notification — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface NotificationModel {
  notification_id: string;
  user_id: string;
  channel: string | null;
  template_key: string | null;
  payload: unknown | null;
  sent_at: string | null;
  read_at: string | null;
}
