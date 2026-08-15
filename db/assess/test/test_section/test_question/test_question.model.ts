/**
 * assess.test_question — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface TestQuestionModel {
  test_question_id: string;
  test_section_id: string;
  question_id: string;
  sequence_no: number;
  marks_override: number | null;
  is_optional: boolean;
  shuffle_seed: number | null;
}
