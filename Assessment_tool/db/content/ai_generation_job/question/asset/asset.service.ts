import type { AssetModel } from "./asset.model.js";
import type { AssetId } from "./asset.repository.js";
import { assetRepository } from "./asset.repository.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../../shared/errors.js";

/**
 * Thin pass-through to the repository. No business rules (state-machine
 * validation, optimistic-concurrency checks) are implemented here — the
 * design pack doesn't specify them for this entity, and no version/updated_at
 * column exists yet to detect a concurrent write. InvalidStateTransitionError
 * and ConcurrentWriteError stay declared in db/shared/errors.ts for whichever
 * layer implements those rules later; this service does not throw them.
 */
export interface AssetService {
  get(id: AssetId): Promise<AssetModel>;
  create(data: Partial<AssetModel>): Promise<AssetModel>;
  update(id: AssetId, data: Partial<AssetModel>): Promise<AssetModel>;
  remove(id: AssetId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: AssetId): Promise<AssetModel> {
  return assetRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AssetModel>): Promise<AssetModel> {
  return assetRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AssetId, data: Partial<AssetModel>): Promise<AssetModel> {
  return assetRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: AssetId): Promise<void> {
  return assetRepository.remove(id);
}

export const assetService: AssetService = { get, create, update, remove };
