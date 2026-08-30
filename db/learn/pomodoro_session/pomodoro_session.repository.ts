import type { PomodoroSessionModel } from "./pomodoro_session.model.js";
import { pool } from "../../shared/pool.js";
import {
  findById as findByIdImpl,
  insertRow,
  updateById as updateByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../shared/repository-helpers.js";

export type PomodoroSessionId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "pomodoro_session",
  entityLabel: "learn.pomodoro_session",
  pkColumns: ["session_id"],
};

export interface PomodoroSessionRepository {
  findById(id: PomodoroSessionId): Promise<PomodoroSessionModel>;
  create(data: Partial<PomodoroSessionModel>): Promise<PomodoroSessionModel>;
  update(id: PomodoroSessionId, data: Partial<PomodoroSessionModel>): Promise<PomodoroSessionModel>;
  remove(id: PomodoroSessionId): Promise<void>;
  /** BUG-22 — "log shows the last 20 sessions." */
  findRecentByUser(userId: string, limit?: number): Promise<PomodoroSessionModel[]>;
}

async function findRecentByUser(userId: string, limit = 20): Promise<PomodoroSessionModel[]> {
  const res = await pool.query<PomodoroSessionModel>(
    `select * from learn.pomodoro_session where user_id = $1 order by created_at desc limit $2`,
    [userId, limit]
  );
  return res.rows;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: PomodoroSessionId): Promise<PomodoroSessionModel> {
  return findByIdImpl<PomodoroSessionModel>(SPEC, { session_id: id });
}

/**
 * @throws {DuplicateKeyError} PK already exists
 * @throws {ForeignKeyViolationError} task_id does not reference a real row
 */
async function create(data: Partial<PomodoroSessionModel>): Promise<PomodoroSessionModel> {
  return insertRow<PomodoroSessionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function update(id: PomodoroSessionId, data: Partial<PomodoroSessionModel>): Promise<PomodoroSessionModel> {
  return updateByIdImpl<PomodoroSessionModel>(SPEC, { session_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: PomodoroSessionId): Promise<void> {
  return deleteByIdImpl(SPEC, { session_id: id });
}

export const pomodoroSessionRepository: PomodoroSessionRepository = { findById, create, update, remove, findRecentByUser };
