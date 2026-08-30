import type { RevisionNoteModel } from "./revision_note.model.js";
import { pool } from "../../shared/pool.js";
import {
  findById as findByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../shared/repository-helpers.js";
import { NotFoundError, DuplicateKeyError, ForeignKeyViolationError } from "../../shared/errors.js";

export type RevisionNoteId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "revision_note",
  entityLabel: "learn.revision_note",
  pkColumns: ["note_id"],
};

export interface RevisionNoteRepository {
  findById(id: RevisionNoteId): Promise<RevisionNoteModel>;
  create(data: Partial<RevisionNoteModel>): Promise<RevisionNoteModel>;
  update(id: RevisionNoteId, data: Partial<RevisionNoteModel>): Promise<RevisionNoteModel>;
  remove(id: RevisionNoteId): Promise<void>;
  findByUser(userId: string): Promise<RevisionNoteModel[]>;
}

// BUG-21 — "sanitise any rich-text input server-side to prevent stored
// XSS." Notes are plain text today (a <textarea>, no rich-text editor), so
// the real, correctly-scoped fix is stripping any HTML markup a client
// might still send (a hand-crafted request, or a future rich-text upgrade)
// rather than pulling in a full HTML-sanitiser dependency for a feature
// that has no HTML to sanitise yet.
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, "");
}

function sanitize(data: Partial<RevisionNoteModel>): Partial<RevisionNoteModel> {
  const clean = { ...data };
  if (typeof clean.title === "string") clean.title = stripHtml(clean.title);
  if (typeof clean.content === "string") clean.content = stripHtml(clean.content);
  if (typeof clean.subject === "string") clean.subject = stripHtml(clean.subject);
  if (typeof clean.topic === "string") clean.topic = stripHtml(clean.topic);
  return clean;
}

async function findByUser(userId: string): Promise<RevisionNoteModel[]> {
  const res = await pool.query<RevisionNoteModel>(
    `select * from learn.revision_note where user_id = $1 order by updated_at desc`,
    [userId]
  );
  return res.rows;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: RevisionNoteId): Promise<RevisionNoteModel> {
  return findByIdImpl<RevisionNoteModel>(SPEC, { note_id: id });
}

/**
 * @throws {DuplicateKeyError} PK already exists
 */
async function create(data: Partial<RevisionNoteModel>): Promise<RevisionNoteModel> {
  const clean = sanitize(data);
  const cols = Object.keys(clean).filter((c) => (clean as Record<string, unknown>)[c] !== undefined);
  const sql = `insert into learn.revision_note (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`;
  try {
    const res = await pool.query<RevisionNoteModel>(sql, cols.map((c) => (clean as Record<string, unknown>)[c]));
    return res.rows[0];
  } catch (err) {
    const pgErr = err as { code?: string; constraint?: string };
    if (pgErr?.code === "23505") throw new DuplicateKeyError(SPEC.entityLabel, pgErr.constraint ?? "unknown constraint");
    if (pgErr?.code === "23503") throw new ForeignKeyViolationError(SPEC.entityLabel, pgErr.constraint ?? "unknown constraint");
    throw err;
  }
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function update(id: RevisionNoteId, data: Partial<RevisionNoteModel>): Promise<RevisionNoteModel> {
  const clean = { ...sanitize(data), updated_at: new Date().toISOString() } as Record<string, unknown>;
  const cols = Object.keys(clean).filter((c) => clean[c] !== undefined);
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const res = await pool.query<RevisionNoteModel>(
    `update learn.revision_note set ${setClause} where note_id = $${cols.length + 1} returning *`,
    [...cols.map((c) => clean[c]), id]
  );
  if (res.rowCount === 0) throw new NotFoundError(SPEC.entityLabel, id);
  return res.rows[0];
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: RevisionNoteId): Promise<void> {
  return deleteByIdImpl(SPEC, { note_id: id });
}

export const revisionNoteRepository: RevisionNoteRepository = { findById, create, update, remove, findByUser };
