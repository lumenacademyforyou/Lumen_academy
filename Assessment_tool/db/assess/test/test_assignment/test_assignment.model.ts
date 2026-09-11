/**
 * assess.test_assignment — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface TestAssignmentModel {
  assignment_id: string;
  test_id: string;
  user_id: string | null;
  batch_id: string | null;
  audience_type: string | null;
  scopes: unknown | null;
  assigned_on: string | null;
  due_on: string | null;
  assignment_status: string;
}
