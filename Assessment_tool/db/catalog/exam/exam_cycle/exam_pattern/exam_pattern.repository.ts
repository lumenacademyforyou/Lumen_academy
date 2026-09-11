import type { ExamPatternModel } from "./exam_pattern.model.js";
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

export type ExamPatternId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "exam_pattern",
  entityLabel: "catalog.exam_pattern",
  pkColumns: ["pattern_id"],
};

export interface ExamPatternRepository {
  findById(id: ExamPatternId): Promise<ExamPatternModel>;
  create(data: Partial<ExamPatternModel>): Promise<ExamPatternModel>;
  update(id: ExamPatternId, data: Partial<ExamPatternModel>): Promise<ExamPatternModel>;
  remove(id: ExamPatternId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: ExamPatternId): Promise<ExamPatternModel> {
  return findByIdImpl<ExamPatternModel>(SPEC, { pattern_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ExamPatternModel>): Promise<ExamPatternModel> {
  return insertRow<ExamPatternModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ExamPatternId, data: Partial<ExamPatternModel>): Promise<ExamPatternModel> {
  return updateByIdImpl<ExamPatternModel>(SPEC, { pattern_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: ExamPatternId): Promise<void> {
  return deleteByIdImpl(SPEC, { pattern_id: id });
}

export const examPatternRepository: ExamPatternRepository = { findById, create, update, remove };
