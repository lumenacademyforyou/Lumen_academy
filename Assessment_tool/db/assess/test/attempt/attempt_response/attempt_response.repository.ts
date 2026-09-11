import type { AttemptResponseModel } from "./attempt_response.model.js";
import {
  findById as findByIdImpl,
  insertRow,
  updateById as updateByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../../../shared/repository-helpers.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../../shared/errors.js";

export type AttemptResponseId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "attempt_response",
  entityLabel: "assess.attempt_response",
  pkColumns: ["response_id"],
};

export interface AttemptResponseRepository {
  findById(id: AttemptResponseId): Promise<AttemptResponseModel>;
  create(data: Partial<AttemptResponseModel>): Promise<AttemptResponseModel>;
  update(id: AttemptResponseId, data: Partial<AttemptResponseModel>): Promise<AttemptResponseModel>;
  remove(id: AttemptResponseId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: AttemptResponseId): Promise<AttemptResponseModel> {
  return findByIdImpl<AttemptResponseModel>(SPEC, { response_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AttemptResponseModel>): Promise<AttemptResponseModel> {
  return insertRow<AttemptResponseModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AttemptResponseId, data: Partial<AttemptResponseModel>): Promise<AttemptResponseModel> {
  return updateByIdImpl<AttemptResponseModel>(SPEC, { response_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: AttemptResponseId): Promise<void> {
  return deleteByIdImpl(SPEC, { response_id: id });
}

export const attemptResponseRepository: AttemptResponseRepository = { findById, create, update, remove };
