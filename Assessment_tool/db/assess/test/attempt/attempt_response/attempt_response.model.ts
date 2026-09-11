/**
 * assess.attempt_response — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface AttemptResponseModel {
  response_id: string;
  attempt_id: string;
  test_question_id: string;
  option_id: string | null;
  selected_option_label: string | null;
  numeric_answer: number | null;
  response_state: string;
  time_spent_seconds: number | null;
  visit_count: number | null;
  is_correct: boolean | null;
  marks_awarded: number | null;
}
