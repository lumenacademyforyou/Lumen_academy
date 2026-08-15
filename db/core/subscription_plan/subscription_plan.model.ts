/**
 * core.subscription_plan — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface SubscriptionPlanModel {
  plan_id: string;
  tier_code: string;
  tier_name: string;
  feature_matrix: unknown;
  language_access: unknown;
  price_amount: number | null;
  duration_days: number | null;
}
