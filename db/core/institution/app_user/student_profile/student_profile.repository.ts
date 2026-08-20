import type { StudentProfile } from "./student_profile.model.js";
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

export type StudentProfileId = string;

const SPEC: TableSpec = {
  schema: "core",
  table: "student_profile",
  entityLabel: "core.student_profile",
  pkColumns: ["user_id"],
};

export interface StudentProfileRepository {
  findById(id: StudentProfileId): Promise<StudentProfile>;
  create(data: Partial<StudentProfile>): Promise<StudentProfile>;
  update(id: StudentProfileId, data: Partial<StudentProfile>): Promise<StudentProfile>;
  remove(id: StudentProfileId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: StudentProfileId): Promise<StudentProfile> {
  return findByIdImpl<StudentProfile>(SPEC, { user_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<StudentProfile>): Promise<StudentProfile> {
  return insertRow<StudentProfile>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: StudentProfileId, data: Partial<StudentProfile>): Promise<StudentProfile> {
  return updateByIdImpl<StudentProfile>(SPEC, { user_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: StudentProfileId): Promise<void> {
  return deleteByIdImpl(SPEC, { user_id: id });
}

export const studentProfileRepository: StudentProfileRepository = { findById, create, update, remove };
