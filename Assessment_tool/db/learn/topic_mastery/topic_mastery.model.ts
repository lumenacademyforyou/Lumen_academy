/**
 * learn.topic_mastery — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface TopicMasteryModel {
  mastery_id: string;
  user_id: string;
  node_id: string;
  mastery_score: number | null;
  attempt_count: number | null;
  correct_ratio: number | null;
  average_time_seconds: number | null;
  last_practised_at: string | null;
  trend_direction: string | null;
}
