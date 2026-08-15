/**
 * assess.test_section — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface TestSectionModel {
  test_section_id: string;
  test_id: string;
  pattern_section_id: string;
  section_name: string;
  sequence_no: number;
  question_count: number | null;
  section_marks: number | null;
}
