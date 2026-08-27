import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { getSupabaseAdmin } from "../../backend/supabaseAdmin.js";
import { dbConfig } from "../config/env.js";
import { pool } from "../shared/pool.js";

/** Anything with pool.query's shape — the default `pool` or a checked-out transaction `client`. */
type Queryable = Pool | PoolClient;

/**
 * CL-3 — Supabase Storage asset resolver (LA-PLAN-002 Day 1, G4).
 *
 * The only place in this codebase that (a) uploads bytes to Supabase Storage
 * for content.asset and (b) turns a stored content.asset.storage_uri back
 * into an openable URL. storage_uri holds a bucket-relative object path
 * (e.g. "question/<question_id>/<fileName>"), never a full URL —
 * resolveAssetUrl() is the sole place a full URL gets built; no caller
 * anywhere else should string-concatenate a Supabase Storage URL.
 *
 * Idempotency: content.asset has no unique constraint on storage_uri (003_
 * content.sql), so this does a select-then-insert-or-update on storage_uri
 * in application code rather than adding a migration for an ON CONFLICT
 * target — the simpler fix given the sole caller (CL-2's importer) always
 * knows the object path up front.
 *
 * Every DB write below accepts an optional `db` (a pg Pool or a checked-out
 * transaction client), defaulting to the shared pool. A caller that inserts
 * content.question and then calls uploadAsset in the same database
 * transaction (CL-2 does exactly this) MUST pass its own client — the
 * question row is invisible to any other connection (including a fresh
 * pool.query() call) until that transaction commits, so the FK from
 * content.asset.question_id would otherwise fail with 23503.
 */

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

function bucketName(): string {
  if (!dbConfig.objectStorageBucket) {
    throw new Error(
      "OBJECT_STORAGE_BUCKET is not set. Add it to .env — the Supabase Storage bucket name content assets upload into."
    );
  }
  return dbConfig.objectStorageBucket;
}

export interface AssetRow {
  asset_id: string;
  question_id: string | null;
  document_id: string | null;
  option_id: string | null;
  asset_type: string;
  storage_uri: string;
  alt_text: string | null;
  render_hint: string | null;
  target_role: string;
  mime_type: string | null;
  byte_size: string | null;
  checksum_sha256: string | null;
}

export interface UploadAssetInput {
  localFilePath: string;
  /** content.asset.ck_asset_owner requires at least one of questionId/documentId/groupId. */
  questionId?: string;
  documentId?: string;
  optionId?: string;
  targetRole: "stem" | "option" | "solution" | "hint" | "passage" | "explanation";
  assetType?: "image" | "diagram" | "graph" | "chemical_structure" | "table" | "audio" | "video";
  altText?: string;
  /** Overrides the default "question/<questionId|documentId>/<fileName>" object path. */
  objectPath?: string;
  /** Pass the transaction client when the owning row was inserted in the same open transaction (see file header). */
  db?: Queryable;
}

/**
 * Uploads a local file to Supabase Storage and inserts/updates the owning
 * content.asset row (matched on storage_uri = the bucket object path).
 * Re-uploading the same local path overwrites the object and updates the
 * same row rather than creating a duplicate.
 *
 * @throws {Error} the file doesn't exist, OBJECT_STORAGE_BUCKET is unset, or
 *   neither questionId nor documentId is given.
 */
export async function uploadAsset(input: UploadAssetInput): Promise<AssetRow> {
  if (!input.questionId && !input.documentId) {
    throw new Error("uploadAsset requires questionId or documentId (content.asset.ck_asset_owner)");
  }
  if (!fs.existsSync(input.localFilePath)) {
    throw new Error(`file not found: ${input.localFilePath}`);
  }

  const bucket = bucketName();
  const bytes = fs.readFileSync(input.localFilePath);
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  const ext = path.extname(input.localFilePath).toLowerCase();
  const mimeType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const fileName = path.basename(input.localFilePath);
  const objectPath = input.objectPath ?? `question/${input.questionId ?? input.documentId}/${fileName}`;
  const db = input.db ?? pool;

  const admin = getSupabaseAdmin();
  const { error: uploadError } = await admin.storage.from(bucket).upload(objectPath, bytes, {
    contentType: mimeType,
    upsert: true,
  });
  if (uploadError) {
    throw new Error(`Supabase Storage upload failed for "${objectPath}": ${uploadError.message}`);
  }

  const existing = await db.query<{ asset_id: string }>(
    `select asset_id from content.asset where storage_uri = $1`,
    [objectPath]
  );

  if (existing.rowCount && existing.rowCount > 0) {
    const res = await db.query<AssetRow>(
      `update content.asset set
         question_id = $2, document_id = $3, option_id = $4, asset_type = $5,
         alt_text = $6, target_role = $7, mime_type = $8, byte_size = $9, checksum_sha256 = $10
       where asset_id = $1
       returning *`,
      [
        existing.rows[0].asset_id,
        input.questionId ?? null,
        input.documentId ?? null,
        input.optionId ?? null,
        input.assetType ?? "image",
        input.altText ?? null,
        input.targetRole,
        mimeType,
        bytes.length,
        checksum,
      ]
    );
    return res.rows[0];
  }

  const res = await db.query<AssetRow>(
    `insert into content.asset
       (question_id, document_id, option_id, asset_type, storage_uri, alt_text, target_role, mime_type, byte_size, checksum_sha256)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     returning *`,
    [
      input.questionId ?? null,
      input.documentId ?? null,
      input.optionId ?? null,
      input.assetType ?? "image",
      objectPath,
      input.altText ?? null,
      input.targetRole,
      mimeType,
      bytes.length,
      checksum,
    ]
  );
  return res.rows[0];
}

/**
 * The sole place a content.asset.storage_uri (a bucket-relative object path)
 * is turned into an openable URL. Bucket is public, so this is a plain
 * public URL — no signed-URL expiry to manage. Never construct a Storage URL
 * by string-concatenation anywhere else.
 */
export function resolveAssetUrl(storageUri: string): string {
  const admin = getSupabaseAdmin();
  const { data } = admin.storage.from(bucketName()).getPublicUrl(storageUri);
  return data.publicUrl;
}
