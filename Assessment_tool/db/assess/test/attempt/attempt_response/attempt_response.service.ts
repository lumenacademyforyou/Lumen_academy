import type { AttemptResponseModel } from "./attempt_response.model.js";
import type { AttemptResponseId } from "./attempt_response.repository.js";
import { attemptResponseRepository } from "./attempt_response.repository.js";
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
export interface AttemptResponseService {
  get(id: AttemptResponseId): Promise<AttemptResponseModel>;
  create(data: Partial<AttemptResponseModel>): Promise<AttemptResponseModel>;
  update(id: AttemptResponseId, data: Partial<AttemptResponseModel>): Promise<AttemptResponseModel>;
  remove(id: AttemptResponseId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: AttemptResponseId): Promise<AttemptResponseModel> {
  return attemptResponseRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AttemptResponseModel>): Promise<AttemptResponseModel> {
  return attemptResponseRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AttemptResponseId, data: Partial<AttemptResponseModel>): Promise<AttemptResponseModel> {
  return attemptResponseRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: AttemptResponseId): Promise<void> {
  return attemptResponseRepository.remove(id);
}

export const attemptResponseService: AttemptResponseService = { get, create, update, remove };
