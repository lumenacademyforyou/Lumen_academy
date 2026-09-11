import type { TestQuestionModel } from "./test_question.model.js";
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

export type TestQuestionId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "test_question",
  entityLabel: "assess.test_question",
  pkColumns: ["test_question_id"],
};

export interface TestQuestionRepository {
  findById(id: TestQuestionId): Promise<TestQuestionModel>;
  create(data: Partial<TestQuestionModel>): Promise<TestQuestionModel>;
  update(id: TestQuestionId, data: Partial<TestQuestionModel>): Promise<TestQuestionModel>;
  remove(id: TestQuestionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: TestQuestionId): Promise<TestQuestionModel> {
  return findByIdImpl<TestQuestionModel>(SPEC, { test_question_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TestQuestionModel>): Promise<TestQuestionModel> {
  return insertRow<TestQuestionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TestQuestionId, data: Partial<TestQuestionModel>): Promise<TestQuestionModel> {
  return updateByIdImpl<TestQuestionModel>(SPEC, { test_question_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: TestQuestionId): Promise<void> {
  return deleteByIdImpl(SPEC, { test_question_id: id });
}

export const testQuestionRepository: TestQuestionRepository = { findById, create, update, remove };
