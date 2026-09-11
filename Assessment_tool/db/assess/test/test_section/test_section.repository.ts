import type { TestSectionModel } from "./test_section.model.js";
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

export type TestSectionId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "test_section",
  entityLabel: "assess.test_section",
  pkColumns: ["test_section_id"],
};

export interface TestSectionRepository {
  findById(id: TestSectionId): Promise<TestSectionModel>;
  create(data: Partial<TestSectionModel>): Promise<TestSectionModel>;
  update(id: TestSectionId, data: Partial<TestSectionModel>): Promise<TestSectionModel>;
  remove(id: TestSectionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: TestSectionId): Promise<TestSectionModel> {
  return findByIdImpl<TestSectionModel>(SPEC, { test_section_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TestSectionModel>): Promise<TestSectionModel> {
  return insertRow<TestSectionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TestSectionId, data: Partial<TestSectionModel>): Promise<TestSectionModel> {
  return updateByIdImpl<TestSectionModel>(SPEC, { test_section_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: TestSectionId): Promise<void> {
  return deleteByIdImpl(SPEC, { test_section_id: id });
}

export const testSectionRepository: TestSectionRepository = { findById, create, update, remove };
