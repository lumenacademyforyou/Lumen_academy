import type { TestModel } from "./test.model.js";
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

export type TestId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "test",
  entityLabel: "assess.test",
  pkColumns: ["test_id"],
};

export interface TestRepository {
  findById(id: TestId): Promise<TestModel>;
  create(data: Partial<TestModel>): Promise<TestModel>;
  update(id: TestId, data: Partial<TestModel>): Promise<TestModel>;
  remove(id: TestId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: TestId): Promise<TestModel> {
  return findByIdImpl<TestModel>(SPEC, { test_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TestModel>): Promise<TestModel> {
  return insertRow<TestModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TestId, data: Partial<TestModel>): Promise<TestModel> {
  return updateByIdImpl<TestModel>(SPEC, { test_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: TestId): Promise<void> {
  return deleteByIdImpl(SPEC, { test_id: id });
}

export const testRepository: TestRepository = { findById, create, update, remove };
