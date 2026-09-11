import type { AttemptEventModel } from "./attempt_event.model.js";
import type { AttemptEventId } from "./attempt_event.repository.js";
import { attemptEventRepository } from "./attempt_event.repository.js";
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
export interface AttemptEventService {
  get(id: AttemptEventId): Promise<AttemptEventModel>;
  create(data: Partial<AttemptEventModel>): Promise<AttemptEventModel>;
  update(id: AttemptEventId, data: Partial<AttemptEventModel>): Promise<AttemptEventModel>;
  remove(id: AttemptEventId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: AttemptEventId): Promise<AttemptEventModel> {
  return attemptEventRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AttemptEventModel>): Promise<AttemptEventModel> {
  return attemptEventRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AttemptEventId, data: Partial<AttemptEventModel>): Promise<AttemptEventModel> {
  return attemptEventRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: AttemptEventId): Promise<void> {
  return attemptEventRepository.remove(id);
}

export const attemptEventService: AttemptEventService = { get, create, update, remove };
