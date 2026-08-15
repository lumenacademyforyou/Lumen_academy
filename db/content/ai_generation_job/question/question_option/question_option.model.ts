/**
 * content.question_option — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface QuestionOptionModel {
  option_id: string;
  question_id: string;
  option_label: string;
  option_text: string;
  is_correct: boolean;
  display_order: number | null;
}
