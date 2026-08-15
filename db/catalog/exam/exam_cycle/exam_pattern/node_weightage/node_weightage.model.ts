/**
 * catalog.node_weightage — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface NodeWeightageModel {
  weightage_id: string;
  pattern_id: string;
  node_id: string;
  weight_marks: number | null;
  expected_questions: number | null;
  priority_rank: number | null;
}
