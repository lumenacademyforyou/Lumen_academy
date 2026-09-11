/**
 * core.batch_member — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface BatchMemberModel {
  batch_id: string;
  user_id: string;
  joined_on: string | null;
  left_on: string | null;
  member_status: string | null;
}
