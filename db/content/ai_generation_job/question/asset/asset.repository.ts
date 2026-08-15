import type { AssetModel } from "./asset.model.js";
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

export type AssetId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "asset",
  entityLabel: "content.asset",
  pkColumns: ["asset_id"],
};

export interface AssetRepository {
  findById(id: AssetId): Promise<AssetModel>;
  create(data: Partial<AssetModel>): Promise<AssetModel>;
  update(id: AssetId, data: Partial<AssetModel>): Promise<AssetModel>;
  remove(id: AssetId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: AssetId): Promise<AssetModel> {
  return findByIdImpl<AssetModel>(SPEC, { asset_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AssetModel>): Promise<AssetModel> {
  return insertRow<AssetModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AssetId, data: Partial<AssetModel>): Promise<AssetModel> {
  return updateByIdImpl<AssetModel>(SPEC, { asset_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: AssetId): Promise<void> {
  return deleteByIdImpl(SPEC, { asset_id: id });
}

export const assetRepository: AssetRepository = { findById, create, update, remove };
