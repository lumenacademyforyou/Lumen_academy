import type { NotificationModel } from "./notification.model.js";
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

export const notificationRepository: NotificationRepository = { findById, create, update, remove };
