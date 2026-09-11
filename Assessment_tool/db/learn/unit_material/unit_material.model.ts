/**
 * learn.unit_material — model
 *
 * docs/neet-tool-fix-prompt.md Task 4a. Mirrors the real columns created by
 * db/migrations/025_unit_materials.sql.
 */
export interface UnitMaterialModel {
  id: string;
  unit_id: string;
  title: string;
  drive_file_id: string;
  mime_type: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}
