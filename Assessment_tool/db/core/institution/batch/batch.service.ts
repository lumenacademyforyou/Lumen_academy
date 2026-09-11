import type { BatchModel } from "./batch.model.js";
import type { BatchId } from "./batch.repository.js";
import { batchRepository } from "./batch.repository.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../shared/errors.js";

/**
 * Thin pass-through to the repository. No business rules (state-machine
 * validation, optimistic-concurrency checks) are implemented here — the
 * design pack doesn't specify them for this entity, and no version/updated_at
 * column exists yet to detect a concurrent write. InvalidStateTransitionError
 * and ConcurrentWriteError stay declared in db/shared/errors.ts for whichever
 * layer implements those rules later; this service does not throw them.
 */
export interface BatchService {
  get(id: BatchId): Promise<BatchModel>;
  create(data: Partial<BatchModel>): Promise<BatchModel>;
  update(id: BatchId, data: Partial<BatchModel>): Promise<BatchModel>;
  remove(id: BatchId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: BatchId): Promise<BatchModel> {
  return batchRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<BatchModel>): Promise<BatchModel> {
  return batchRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: BatchId, data: Partial<BatchModel>): Promise<BatchModel> {
  return batchRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: BatchId): Promise<void> {
  return batchRepository.remove(id);
}

export const batchService: BatchService = { get, create, update, remove };
