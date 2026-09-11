import type { AttemptModel } from "./attempt.model.js";
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

export type AttemptId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "attempt",
  entityLabel: "assess.attempt",
  pkColumns: ["attempt_id"],
};

export interface AttemptRepository {
  findById(id: AttemptId): Promise<AttemptModel>;
  create(data: Partial<AttemptModel>): Promise<AttemptModel>;
  update(id: AttemptId, data: Partial<AttemptModel>): Promise<AttemptModel>;
  remove(id: AttemptId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: AttemptId): Promise<AttemptModel> {
  return findByIdImpl<AttemptModel>(SPEC, { attempt_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AttemptModel>): Promise<AttemptModel> {
  return insertRow<AttemptModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AttemptId, data: Partial<AttemptModel>): Promise<AttemptModel> {
  return updateByIdImpl<AttemptModel>(SPEC, { attempt_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: AttemptId): Promise<void> {
  return deleteByIdImpl(SPEC, { attempt_id: id });
}

export const attemptRepository: AttemptRepository = { findById, create, update, remove };
