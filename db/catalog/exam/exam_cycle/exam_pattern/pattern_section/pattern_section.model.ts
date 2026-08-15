/**
 * catalog.pattern_section — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface PatternSectionModel {
  pattern_section_id: string;
  pattern_id: string;
  subject_id: string;
  scheme_id: string;
  section_name: string;
  sequence_no: number;
  question_count: number;
  optional_count: number;
  section_time_limit: number | null;
}
