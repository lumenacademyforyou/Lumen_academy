import type { EducatorProfileModel } from "./educator_profile.model.js";
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

export type EducatorProfileId = string;

const SPEC: TableSpec = {
  schema: "core",
  table: "educator_profile",
  entityLabel: "core.educator_profile",
  pkColumns: ["user_id"],
};

export interface EducatorProfileRepository {
  findById(id: EducatorProfileId): Promise<EducatorProfileModel>;
  create(data: Partial<EducatorProfileModel>): Promise<EducatorProfileModel>;
  update(id: EducatorProfileId, data: Partial<EducatorProfileModel>): Promise<EducatorProfileModel>;
  remove(id: EducatorProfileId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: EducatorProfileId): Promise<EducatorProfileModel> {
  return findByIdImpl<EducatorProfileModel>(SPEC, { user_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<EducatorProfileModel>): Promise<EducatorProfileModel> {
  return insertRow<EducatorProfileModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: EducatorProfileId, data: Partial<EducatorProfileModel>): Promise<EducatorProfileModel> {
  return updateByIdImpl<EducatorProfileModel>(SPEC, { user_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: EducatorProfileId): Promise<void> {
  return deleteByIdImpl(SPEC, { user_id: id });
}

export const educatorProfileRepository: EducatorProfileRepository = { findById, create, update, remove };
