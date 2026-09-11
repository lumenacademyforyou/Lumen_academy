import type { NotificationModel } from "./notification.model.js";
import { pool } from "../../shared/pool.js";
import {
  findById as findByIdImpl,
  insertRow,
  updateById as updateByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../shared/repository-helpers.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../shared/errors.js";

export type NotificationId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "notification",
  entityLabel: "learn.notification",
  pkColumns: ["notification_id"],
};

export interface NotificationRepository {
  findById(id: NotificationId): Promise<NotificationModel>;
  create(data: Partial<NotificationModel>): Promise<NotificationModel>;
  update(id: NotificationId, data: Partial<NotificationModel>): Promise<NotificationModel>;
  remove(id: NotificationId): Promise<void>;
  findByUser(userId: string): Promise<NotificationModel[]>;
  markAllRead(userId: string): Promise<void>;
  clearAll(userId: string): Promise<void>;
}

// No generic "list mine" helper exists in repository-helpers.ts yet — every
// other entity there is fetched one row at a time by id. Notifications are
// the first entity that actually needs "give me all of mine", so that query
// lives here rather than growing repository-helpers.ts a generic findMany
// before a second caller actually needs one.
async function findByUser(userId: string): Promise<NotificationModel[]> {
  // The table has no created_at (see notification.model.ts) — sent_at is
  // the only timestamp it carries, and it's nullable. Most-recent-first by
  // sent_at, with unsent (sent_at is null) rows trailing.
  const res = await pool.query<NotificationModel>(
    `select * from learn.notification where user_id = $1 order by sent_at desc nulls last`,
    [userId]
  );
  return res.rows;
}

async function markAllRead(userId: string): Promise<void> {
  await pool.query(`update learn.notification set read_at = now() where user_id = $1 and read_at is null`, [userId]);
}

// P0-5 (docs/assessment-tool-fix-prompt.md) — "Clear all": a real delete,
// scoped to the caller's own rows, not a soft-dismiss flag (this table has
// none to set).
async function clearAll(userId: string): Promise<void> {
  await pool.query(`delete from learn.notification where user_id = $1`, [userId]);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: NotificationId): Promise<NotificationModel> {
  return findByIdImpl<NotificationModel>(SPEC, { notification_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<NotificationModel>): Promise<NotificationModel> {
  return insertRow<NotificationModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: NotificationId, data: Partial<NotificationModel>): Promise<NotificationModel> {
  return updateByIdImpl<NotificationModel>(SPEC, { notification_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: NotificationId): Promise<void> {
  return deleteByIdImpl(SPEC, { notification_id: id });
}

export const notificationRepository: NotificationRepository = { findById, create, update, remove, findByUser, markAllRead, clearAll };
