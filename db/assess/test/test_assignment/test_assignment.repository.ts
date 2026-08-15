import type { TestAssignmentModel } from "./test_assignment.model.js";
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

export type TestAssignmentId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "test_assignment",
  entityLabel: "assess.test_assignment",
  pkColumns: ["assignment_id"],
};

export interface TestAssignmentRepository {
  findById(id: TestAssignmentId): Promise<TestAssignmentModel>;
  create(data: Partial<TestAssignmentModel>): Promise<TestAssignmentModel>;
  update(id: TestAssignmentId, data: Partial<TestAssignmentModel>): Promise<TestAssignmentModel>;
  remove(id: TestAssignmentId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: TestAssignmentId): Promise<TestAssignmentModel> {
  return findByIdImpl<TestAssignmentModel>(SPEC, { assignment_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TestAssignmentModel>): Promise<TestAssignmentModel> {
  return insertRow<TestAssignmentModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TestAssignmentId, data: Partial<TestAssignmentModel>): Promise<TestAssignmentModel> {
  return updateByIdImpl<TestAssignmentModel>(SPEC, { assignment_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: TestAssignmentId): Promise<void> {
  return deleteByIdImpl(SPEC, { assignment_id: id });
}

export const testAssignmentRepository: TestAssignmentRepository = { findById, create, update, remove };
