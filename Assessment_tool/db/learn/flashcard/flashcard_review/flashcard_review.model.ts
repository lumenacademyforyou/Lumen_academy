/**
 * learn.flashcard_review — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface FlashcardReviewModel {
  flashcard_review_id: string;
  flashcard_id: string;
  reviewed_at: string | null;
  recall_grade: number | null;
  ease_factor: number | null;
  interval_days: number | null;
  next_due_on: string | null;
}
