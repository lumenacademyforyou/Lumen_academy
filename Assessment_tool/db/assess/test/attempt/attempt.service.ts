import type { AttemptModel } from "./attempt.model.js";
import type { AttemptId } from "./attempt.repository.js";
import { attemptRepository } from "./attempt.repository.js";
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
export interface AttemptService {
  get(id: AttemptId): Promise<AttemptModel>;
  create(data: Partial<AttemptModel>): Promise<AttemptModel>;
  update(id: AttemptId, data: Partial<AttemptModel>): Promise<AttemptModel>;
  remove(id: AttemptId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: AttemptId): Promise<AttemptModel> {
  return attemptRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AttemptModel>): Promise<AttemptModel> {
  return attemptRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AttemptId, data: Partial<AttemptModel>): Promise<AttemptModel> {
  return attemptRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: AttemptId): Promise<void> {
  return attemptRepository.remove(id);
}

export const attemptService: AttemptService = { get, create, update, remove };
