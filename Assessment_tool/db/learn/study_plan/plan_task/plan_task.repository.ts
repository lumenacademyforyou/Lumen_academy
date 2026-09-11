import type { PlanTaskModel } from "./plan_task.model.js";
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

export type PlanTaskId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "plan_task",
  entityLabel: "learn.plan_task",
  pkColumns: ["task_id"],
};

export interface PlanTaskRepository {
  findById(id: PlanTaskId): Promise<PlanTaskModel>;
  create(data: Partial<PlanTaskModel>): Promise<PlanTaskModel>;
  update(id: PlanTaskId, data: Partial<PlanTaskModel>): Promise<PlanTaskModel>;
  remove(id: PlanTaskId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: PlanTaskId): Promise<PlanTaskModel> {
  return findByIdImpl<PlanTaskModel>(SPEC, { task_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<PlanTaskModel>): Promise<PlanTaskModel> {
  return insertRow<PlanTaskModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: PlanTaskId, data: Partial<PlanTaskModel>): Promise<PlanTaskModel> {
  return updateByIdImpl<PlanTaskModel>(SPEC, { task_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: PlanTaskId): Promise<void> {
  return deleteByIdImpl(SPEC, { task_id: id });
}

export const planTaskRepository: PlanTaskRepository = { findById, create, update, remove };
