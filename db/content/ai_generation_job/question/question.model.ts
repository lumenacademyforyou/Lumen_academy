/**
 * content.question — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface QuestionModel {
  question_id: string;
  question_uid: string;
  primary_node_id: string;
  job_id: string;
  question_type: string | null;
  difficulty_band: string | null;
  stem_text: string;
  numeric_answer: number | null;
  answer_tolerance: number | null;
  origin_year: number | null;
  usage_count: number;
  lifecycle_status: string;
}
