/**
 * content.question_review — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface QuestionReviewModel {
  review_id: string;
  question_id: string;
  reviewer_user_id: string;
  job_id: string;
  reviewer_type: string | null;
  verdict: string;
  issue_codes: unknown | null;
  reviewer_note: string | null;
  reviewed_at: string | null;
}
