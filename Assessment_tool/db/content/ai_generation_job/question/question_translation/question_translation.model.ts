/**
 * content.question_translation — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface QuestionTranslationModel {
  translation_id: string;
  question_id: string;
  language_code: string;
  stem_text: string;
  option_texts: unknown | null;
  translated_by: string | null;
  review_status: string;
}
