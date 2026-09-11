import type { ExamModel } from "./exam.model.js";
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

export type ExamId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "exam",
  entityLabel: "catalog.exam",
  pkColumns: ["exam_id"],
};

export interface ExamRepository {
  findById(id: ExamId): Promise<ExamModel>;
  create(data: Partial<ExamModel>): Promise<ExamModel>;
  update(id: ExamId, data: Partial<ExamModel>): Promise<ExamModel>;
  remove(id: ExamId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: ExamId): Promise<ExamModel> {
  return findByIdImpl<ExamModel>(SPEC, { exam_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ExamModel>): Promise<ExamModel> {
  return insertRow<ExamModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ExamId, data: Partial<ExamModel>): Promise<ExamModel> {
  return updateByIdImpl<ExamModel>(SPEC, { exam_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: ExamId): Promise<void> {
  return deleteByIdImpl(SPEC, { exam_id: id });
}

export const examRepository: ExamRepository = { findById, create, update, remove };
