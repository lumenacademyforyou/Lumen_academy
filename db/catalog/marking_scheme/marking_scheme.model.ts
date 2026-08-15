/**
 * catalog.marking_scheme — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface MarkingSchemeModel {
  scheme_id: string;
  scheme_code: string;
  correct_marks: number;
  incorrect_marks: number;
  unattempted_marks: number;
  partial_credit_rule: string | null;
  numeric_tolerance_pct: number | null;
}
