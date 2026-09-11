import type { BatchModel } from "./batch.model.js";
import {
  findById as findByIdImpl,
  insertRow,
  updateById as updateByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../../shared/repository-helpers.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../shared/errors.js";

export type BatchId = string;

const SPEC: TableSpec = {
  schema: "core",
  table: "batch",
  entityLabel: "core.batch",
  pkColumns: ["batch_id"],
};

export interface BatchRepository {
  findById(id: BatchId): Promise<BatchModel>;
  create(data: Partial<BatchModel>): Promise<BatchModel>;
  update(id: BatchId, data: Partial<BatchModel>): Promise<BatchModel>;
  remove(id: BatchId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: BatchId): Promise<BatchModel> {
  return findByIdImpl<BatchModel>(SPEC, { batch_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<BatchModel>): Promise<BatchModel> {
  return insertRow<BatchModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: BatchId, data: Partial<BatchModel>): Promise<BatchModel> {
  return updateByIdImpl<BatchModel>(SPEC, { batch_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: BatchId): Promise<void> {
  return deleteByIdImpl(SPEC, { batch_id: id });
}

export const batchRepository: BatchRepository = { findById, create, update, remove };
