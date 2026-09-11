import type { ExamCycleModel } from "./exam_cycle.model.js";
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

export type ExamCycleId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "exam_cycle",
  entityLabel: "catalog.exam_cycle",
  pkColumns: ["cycle_id"],
};

export interface ExamCycleRepository {
  findById(id: ExamCycleId): Promise<ExamCycleModel>;
  create(data: Partial<ExamCycleModel>): Promise<ExamCycleModel>;
  update(id: ExamCycleId, data: Partial<ExamCycleModel>): Promise<ExamCycleModel>;
  remove(id: ExamCycleId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: ExamCycleId): Promise<ExamCycleModel> {
  return findByIdImpl<ExamCycleModel>(SPEC, { cycle_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ExamCycleModel>): Promise<ExamCycleModel> {
  return insertRow<ExamCycleModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ExamCycleId, data: Partial<ExamCycleModel>): Promise<ExamCycleModel> {
  return updateByIdImpl<ExamCycleModel>(SPEC, { cycle_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: ExamCycleId): Promise<void> {
  return deleteByIdImpl(SPEC, { cycle_id: id });
}

export const examCycleRepository: ExamCycleRepository = { findById, create, update, remove };
