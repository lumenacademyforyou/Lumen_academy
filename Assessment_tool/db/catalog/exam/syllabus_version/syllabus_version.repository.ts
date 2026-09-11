import type { SyllabusVersionModel } from "./syllabus_version.model.js";
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

export type SyllabusVersionId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "syllabus_version",
  entityLabel: "catalog.syllabus_version",
  pkColumns: ["syllabus_version_id"],
};

export interface SyllabusVersionRepository {
  findById(id: SyllabusVersionId): Promise<SyllabusVersionModel>;
  create(data: Partial<SyllabusVersionModel>): Promise<SyllabusVersionModel>;
  update(id: SyllabusVersionId, data: Partial<SyllabusVersionModel>): Promise<SyllabusVersionModel>;
  remove(id: SyllabusVersionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: SyllabusVersionId): Promise<SyllabusVersionModel> {
  return findByIdImpl<SyllabusVersionModel>(SPEC, { syllabus_version_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SyllabusVersionModel>): Promise<SyllabusVersionModel> {
  return insertRow<SyllabusVersionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SyllabusVersionId, data: Partial<SyllabusVersionModel>): Promise<SyllabusVersionModel> {
  return updateByIdImpl<SyllabusVersionModel>(SPEC, { syllabus_version_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: SyllabusVersionId): Promise<void> {
  return deleteByIdImpl(SPEC, { syllabus_version_id: id });
}

export const syllabusVersionRepository: SyllabusVersionRepository = { findById, create, update, remove };
