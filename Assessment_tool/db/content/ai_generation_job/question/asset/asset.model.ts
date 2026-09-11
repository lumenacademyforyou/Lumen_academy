/**
 * content.asset — model
 *
 * Mirrors the real columns created by db/migrations (see that file for the
 * authoritative column list, defaults and constraints). Nullability here
 * matches the NOT NULL constraints actually applied in Postgres.
 */
export interface AssetModel {
  asset_id: string;
  question_id: string | null;
  document_id: string | null;
  asset_type: string;
  storage_uri: string;
  alt_text: string | null;
  render_hint: string | null;
}
