/**
 * content.question_node_map — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface QuestionNodeMapModel {
  question_id: string;
  node_id: string;
  relevance_rank: number | null;
  tagged_by: string | null;
  tagged_at: string | null;
}
