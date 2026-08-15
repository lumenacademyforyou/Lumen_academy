import type { EnrollmentModel } from "./enrollment.model.js";
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

export type EnrollmentId = string;

const SPEC: TableSpec = {
  schema: "core",
  table: "enrollment",
  entityLabel: "core.enrollment",
  pkColumns: ["enrollment_id"],
};

export interface EnrollmentRepository {
  findById(id: EnrollmentId): Promise<EnrollmentModel>;
  create(data: Partial<EnrollmentModel>): Promise<EnrollmentModel>;
  update(id: EnrollmentId, data: Partial<EnrollmentModel>): Promise<EnrollmentModel>;
  remove(id: EnrollmentId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: EnrollmentId): Promise<EnrollmentModel> {
  return findByIdImpl<EnrollmentModel>(SPEC, { enrollment_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<EnrollmentModel>): Promise<EnrollmentModel> {
  return insertRow<EnrollmentModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: EnrollmentId, data: Partial<EnrollmentModel>): Promise<EnrollmentModel> {
  return updateByIdImpl<EnrollmentModel>(SPEC, { enrollment_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: EnrollmentId): Promise<void> {
  return deleteByIdImpl(SPEC, { enrollment_id: id });
}

export const enrollmentRepository: EnrollmentRepository = { findById, create, update, remove };
