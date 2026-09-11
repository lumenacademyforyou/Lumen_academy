import type { QuestionSolutionModel } from "./question_solution.model.js";
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

export type QuestionSolutionId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "question_solution",
  entityLabel: "content.question_solution",
  pkColumns: ["solution_id"],
};

export interface QuestionSolutionRepository {
  findById(id: QuestionSolutionId): Promise<QuestionSolutionModel>;
  create(data: Partial<QuestionSolutionModel>): Promise<QuestionSolutionModel>;
  update(id: QuestionSolutionId, data: Partial<QuestionSolutionModel>): Promise<QuestionSolutionModel>;
  remove(id: QuestionSolutionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: QuestionSolutionId): Promise<QuestionSolutionModel> {
  return findByIdImpl<QuestionSolutionModel>(SPEC, { solution_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionSolutionModel>): Promise<QuestionSolutionModel> {
  return insertRow<QuestionSolutionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionSolutionId, data: Partial<QuestionSolutionModel>): Promise<QuestionSolutionModel> {
  return updateByIdImpl<QuestionSolutionModel>(SPEC, { solution_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: QuestionSolutionId): Promise<void> {
  return deleteByIdImpl(SPEC, { solution_id: id });
}

export const questionSolutionRepository: QuestionSolutionRepository = { findById, create, update, remove };
