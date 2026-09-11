/**
 * catalog.syllabus_node — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface SyllabusNodeModel {
  node_id: string;
  syllabus_version_id: string;
  subject_id: string;
  parent_node_id: string | null;
  tag_code: string;
  node_type: string;
  title: string;
  class_level: string | null;
  depth: number;
  display_order: number | null;
}
