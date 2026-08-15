/**
 * content.question_solution — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface QuestionSolutionModel {
  solution_id: string;
  question_id: string;
  explanation_text: string;
  step_sequence: unknown | null;
  formula_reference: string | null;
  expected_solve_seconds: number | null;
}
