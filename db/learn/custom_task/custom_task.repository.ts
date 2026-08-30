import type { CustomTaskModel } from "./custom_task.model.js";
import { pool } from "../../shared/pool.js";
import {
  findById as findByIdImpl,
  insertRow,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../shared/repository-helpers.js";
import { NotFoundError } from "../../shared/errors.js";

export type CustomTaskId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "custom_task",
  entityLabel: "learn.custom_task",
  pkColumns: ["task_id"],
};

export interface CustomTaskRepository {
  findById(id: CustomTaskId): Promise<CustomTaskModel>;
  create(data: Partial<CustomTaskModel>): Promise<CustomTaskModel>;
  update(id: CustomTaskId, data: Partial<CustomTaskModel>): Promise<CustomTaskModel>;
  remove(id: CustomTaskId): Promise<void>;
  findByUser(userId: string): Promise<CustomTaskModel[]>;
}

async function findByUser(userId: string): Promise<CustomTaskModel[]> {
  const res = await pool.query<CustomTaskModel>(
    `select * from learn.custom_task where user_id = $1 order by created_at desc`,
    [userId]
  );
  return res.rows;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: CustomTaskId): Promise<CustomTaskModel> {
  return findByIdImpl<CustomTaskModel>(SPEC, { task_id: id });
}

/**
 * @throws {DuplicateKeyError} PK already exists
 */
async function create(data: Partial<CustomTaskModel>): Promise<CustomTaskModel> {
  return insertRow<CustomTaskModel>(SPEC, data as Record<string, unknown>);
}

/**
 * BUG-20 — "completing a task" flips completed_at alongside is_completed
 * rather than leaving it stale, so a dashboard counter reading completed_at
 * (e.g. "completed today") behaves correctly without the caller having to
 * remember to set both fields itself.
 *
 * @throws {NotFoundError} id does not match any row
 */
async function update(id: CustomTaskId, data: Partial<CustomTaskModel>): Promise<CustomTaskModel> {
  const patch: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };
  if (data.is_completed !== undefined) {
    patch.completed_at = data.is_completed ? new Date().toISOString() : null;
  }
  const cols = Object.keys(patch).filter((c) => patch[c] !== undefined);
  const setClause = cols.map((c, i) => `${c} = $${i + 1}`).join(", ");
  const res = await pool.query<CustomTaskModel>(
    `update learn.custom_task set ${setClause} where task_id = $${cols.length + 1} returning *`,
    [...cols.map((c) => patch[c]), id]
  );
  if (res.rowCount === 0) throw new NotFoundError(SPEC.entityLabel, id);
  return res.rows[0];
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: CustomTaskId): Promise<void> {
  return deleteByIdImpl(SPEC, { task_id: id });
}

export const customTaskRepository: CustomTaskRepository = { findById, create, update, remove, findByUser };
