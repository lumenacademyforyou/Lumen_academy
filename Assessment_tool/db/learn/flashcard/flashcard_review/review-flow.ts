import { pool } from "../../../shared/pool.js";
import type { FlashcardReviewModel } from "./flashcard_review.model.js";

// Ownership of flashcardId is verified ONCE per request by
// backend/middleware/ownership.ts's requireDeckOwnership before either of
// these run.

export async function listFlashcardReviews(flashcardId: string): Promise<FlashcardReviewModel[]> {
  const res = await pool.query<FlashcardReviewModel>(
    "select * from learn.flashcard_review where flashcard_id = $1 order by reviewed_at nulls last",
    [flashcardId]
  );
  return res.rows;
}

export interface CreateReviewInput {
  recall_grade?: number | null;
  ease_factor?: number | null;
  interval_days?: number | null;
  next_due_on?: string | null;
}

export async function createFlashcardReview(flashcardId: string, data: CreateReviewInput): Promise<FlashcardReviewModel> {
  const res = await pool.query<FlashcardReviewModel>(
    `insert into learn.flashcard_review (flashcard_id, reviewed_at, recall_grade, ease_factor, interval_days, next_due_on)
     values ($1, now(), $2, $3, $4, $5)
     returning *`,
    [flashcardId, data.recall_grade ?? null, data.ease_factor ?? null, data.interval_days ?? null, data.next_due_on ?? null]
  );
  return res.rows[0];
}
