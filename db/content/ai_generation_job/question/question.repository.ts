import type { QuestionModel } from "./question.model.js";
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

export type QuestionId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "question",
  entityLabel: "content.question",
  pkColumns: ["question_id"],
};

export interface QuestionRepository {
  findById(id: QuestionId): Promise<QuestionModel>;
  create(data: Partial<QuestionModel>): Promise<QuestionModel>;
  update(id: QuestionId, data: Partial<QuestionModel>): Promise<QuestionModel>;
  remove(id: QuestionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: QuestionId): Promise<QuestionModel> {
  return findByIdImpl<QuestionModel>(SPEC, { question_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionModel>): Promise<QuestionModel> {
  return insertRow<QuestionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionId, data: Partial<QuestionModel>): Promise<QuestionModel> {
  return updateByIdImpl<QuestionModel>(SPEC, { question_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: QuestionId): Promise<void> {
  return deleteByIdImpl(SPEC, { question_id: id });
}

export const questionRepository: QuestionRepository = { findById, create, update, remove };
