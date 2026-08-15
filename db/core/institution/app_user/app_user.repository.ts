import type { AppUserModel } from "./app_user.model.js";
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

export type AppUserId = string;

const SPEC: TableSpec = {
  schema: "core",
  table: "app_user",
  entityLabel: "core.app_user",
  pkColumns: ["user_id"],
};

export interface AppUserRepository {
  findById(id: AppUserId): Promise<AppUserModel>;
  create(data: Partial<AppUserModel>): Promise<AppUserModel>;
  update(id: AppUserId, data: Partial<AppUserModel>): Promise<AppUserModel>;
  remove(id: AppUserId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: AppUserId): Promise<AppUserModel> {
  return findByIdImpl<AppUserModel>(SPEC, { user_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AppUserModel>): Promise<AppUserModel> {
  return insertRow<AppUserModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AppUserId, data: Partial<AppUserModel>): Promise<AppUserModel> {
  return updateByIdImpl<AppUserModel>(SPEC, { user_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: AppUserId): Promise<void> {
  return deleteByIdImpl(SPEC, { user_id: id });
}

export const appUserRepository: AppUserRepository = { findById, create, update, remove };
