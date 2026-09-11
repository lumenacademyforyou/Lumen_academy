import type { ErrorLogModel } from "./error_log.model.js";
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

export type ErrorLogId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "error_log",
  entityLabel: "learn.error_log",
  pkColumns: ["error_log_id"],
};

export interface ErrorLogRepository {
  findById(id: ErrorLogId): Promise<ErrorLogModel>;
  create(data: Partial<ErrorLogModel>): Promise<ErrorLogModel>;
  update(id: ErrorLogId, data: Partial<ErrorLogModel>): Promise<ErrorLogModel>;
  remove(id: ErrorLogId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: ErrorLogId): Promise<ErrorLogModel> {
  return findByIdImpl<ErrorLogModel>(SPEC, { error_log_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ErrorLogModel>): Promise<ErrorLogModel> {
  return insertRow<ErrorLogModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ErrorLogId, data: Partial<ErrorLogModel>): Promise<ErrorLogModel> {
  return updateByIdImpl<ErrorLogModel>(SPEC, { error_log_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: ErrorLogId): Promise<void> {
  return deleteByIdImpl(SPEC, { error_log_id: id });
}

export const errorLogRepository: ErrorLogRepository = { findById, create, update, remove };
