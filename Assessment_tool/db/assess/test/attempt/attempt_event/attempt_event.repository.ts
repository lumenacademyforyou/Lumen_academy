import type { AttemptEventModel } from "./attempt_event.model.js";
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

export type AttemptEventId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "attempt_event",
  entityLabel: "assess.attempt_event",
  pkColumns: ["event_id"],
};

export interface AttemptEventRepository {
  findById(id: AttemptEventId): Promise<AttemptEventModel>;
  create(data: Partial<AttemptEventModel>): Promise<AttemptEventModel>;
  update(id: AttemptEventId, data: Partial<AttemptEventModel>): Promise<AttemptEventModel>;
  remove(id: AttemptEventId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: AttemptEventId): Promise<AttemptEventModel> {
  return findByIdImpl<AttemptEventModel>(SPEC, { event_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AttemptEventModel>): Promise<AttemptEventModel> {
  return insertRow<AttemptEventModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AttemptEventId, data: Partial<AttemptEventModel>): Promise<AttemptEventModel> {
  return updateByIdImpl<AttemptEventModel>(SPEC, { event_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: AttemptEventId): Promise<void> {
  return deleteByIdImpl(SPEC, { event_id: id });
}

export const attemptEventRepository: AttemptEventRepository = { findById, create, update, remove };
