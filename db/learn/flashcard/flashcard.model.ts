/**
 * learn.flashcard — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface FlashcardModel {
  flashcard_id: string;
  user_id: string;
  node_id: string | null;
  question_id: string | null;
  front_text: string;
  back_text: string;
  card_type: string | null;
  created_from: string | null;
}
