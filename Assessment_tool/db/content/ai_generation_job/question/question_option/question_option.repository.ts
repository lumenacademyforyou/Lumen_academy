import type { QuestionOptionModel } from "./question_option.model.js";
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

export type QuestionOptionId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "question_option",
  entityLabel: "content.question_option",
  pkColumns: ["option_id"],
};

export interface QuestionOptionRepository {
  findById(id: QuestionOptionId): Promise<QuestionOptionModel>;
  create(data: Partial<QuestionOptionModel>): Promise<QuestionOptionModel>;
  update(id: QuestionOptionId, data: Partial<QuestionOptionModel>): Promise<QuestionOptionModel>;
  remove(id: QuestionOptionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: QuestionOptionId): Promise<QuestionOptionModel> {
  return findByIdImpl<QuestionOptionModel>(SPEC, { option_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionOptionModel>): Promise<QuestionOptionModel> {
  return insertRow<QuestionOptionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionOptionId, data: Partial<QuestionOptionModel>): Promise<QuestionOptionModel> {
  return updateByIdImpl<QuestionOptionModel>(SPEC, { option_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: QuestionOptionId): Promise<void> {
  return deleteByIdImpl(SPEC, { option_id: id });
}

export const questionOptionRepository: QuestionOptionRepository = { findById, create, update, remove };
