import { pool } from "./pool.js";
import { NotFoundError, DuplicateKeyError, ForeignKeyViolationError } from "./errors.js";

export interface TableSpec {
  schema: string;
  table: string;
  /** e.g. "catalog.exam" — used in typed-error messages */
  entityLabel: string;
  pkColumns: string[];
}

function qualifiedTable(spec: TableSpec): string {
  return `${spec.schema}.${spec.table}`;
}

function whereClause(pkColumns: string[], startIndex: number): string {
  return pkColumns.map((c, i) => `${c} = $${startIndex + i}`).join(" and ");
}

function pkValues(spec: TableSpec, id: Record<string, unknown>): unknown[] {
  return spec.pkColumns.map((c) => id[c]);
}

function translateWriteError(spec: TableSpec, err: unknown): Error {
  const pgErr = err as { code?: string; constraint?: string };
  if (pgErr?.code === "23505") return new DuplicateKeyError(spec.entityLabel, pgErr.constraint ?? "unknown constraint");
  if (pgErr?.code === "23503") return new ForeignKeyViolationError(spec.entityLabel, pgErr.constraint ?? "unknown constraint");
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * @throws {NotFoundError} id does not match any row
 */
export async function findById<T>(spec: TableSpec, id: Record<string, unknown>): Promise<T> {
  const sql = `select * from ${qualifiedTable(spec)} where ${whereClause(spec.pkColumns, 1)}`;
  const res = await pool.query(sql, pkValues(spec, id));
  if (res.rowCount === 0) throw new NotFoundError(spec.entityLabel, id);
  return res.rows[0] as T;
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
export async function insertRow<T>(spec: TableSpec, data: Record<string, unknown>): Promise<T> {
  const cols = Object.keys(data).filter((c) => data[c] !== undefined);
  const sql = cols.length === 0
    ? `insert into ${qualifiedTable(spec)} default values returning *`
    : `insert into ${qualifiedTable(spec)} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")}) returning *`;
  try {
    const res = await pool.query(sql, cols.map((c) => data[c]));
    return res.rows[0] as T;
  } catch (err) {
    throw translateWriteError(spec, err);
  }
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
export async function updateById<T>(spec: TableSpec, id: Record<string, unknown>, data: Record<string, unknown>): Promise<T> {
  const cols = Object.keys(data).filter((c) => data[c] !== undefined);
  if (cols.length === 0) return findById<T>(spec, id);
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const sql = `update ${qualifiedTable(spec)} set ${setClause} where ${whereClause(spec.pkColumns, cols.length + 1)} returning *`;
  try {
    const res = await pool.query(sql, [...cols.map((c) => data[c]), ...pkValues(spec, id)]);
    if (res.rowCount === 0) throw new NotFoundError(spec.entityLabel, id);
    return res.rows[0] as T;
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw translateWriteError(spec, err);
  }
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
export async function deleteById(spec: TableSpec, id: Record<string, unknown>): Promise<void> {
  const sql = `delete from ${qualifiedTable(spec)} where ${whereClause(spec.pkColumns, 1)}`;
  try {
    const res = await pool.query(sql, pkValues(spec, id));
    if (res.rowCount === 0) throw new NotFoundError(spec.entityLabel, id);
  } catch (err) {
    if (err instanceof NotFoundError) throw err;
    throw translateWriteError(spec, err);
  }
}
