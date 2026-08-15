/**
 * core.subscription — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface SubscriptionModel {
  subscription_id: string;
  user_id: string;
  plan_id: string;
  started_on: string | null;
  expires_on: string | null;
  payment_reference: string | null;
  subscription_status: string;
}
