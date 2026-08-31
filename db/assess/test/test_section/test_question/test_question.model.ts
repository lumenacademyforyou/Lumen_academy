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
  // Denormalized from test_section.test_id by a trigger (027_test_question_
  // cross_section_unique.sql) — backs uq_test_question_test_id_question_id,
  // the test-layer-hardening A1 fix for cross-section duplicate questions.
  // Always set by the trigger; never assign it directly from application code.
  test_id: string;
  question_id: string;
  sequence_no: number;
  marks_override: number | null;
  is_optional: boolean;
  shuffle_seed: number | null;
}
