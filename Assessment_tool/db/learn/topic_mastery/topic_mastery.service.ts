import type { TopicMasteryModel } from "./topic_mastery.model.js";
import type { TopicMasteryId } from "./topic_mastery.repository.js";
import { topicMasteryRepository } from "./topic_mastery.repository.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../shared/errors.js";

/**
 * Thin pass-through to the repository. No business rules (state-machine
 * validation, optimistic-concurrency checks) are implemented here — the
 * design pack doesn't specify them for this entity, and no version/updated_at
 * column exists yet to detect a concurrent write. InvalidStateTransitionError
 * and ConcurrentWriteError stay declared in db/shared/errors.ts for whichever
 * layer implements those rules later; this service does not throw them.
 */
export interface TopicMasteryService {
  get(id: TopicMasteryId): Promise<TopicMasteryModel>;
  create(data: Partial<TopicMasteryModel>): Promise<TopicMasteryModel>;
  update(id: TopicMasteryId, data: Partial<TopicMasteryModel>): Promise<TopicMasteryModel>;
  remove(id: TopicMasteryId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: TopicMasteryId): Promise<TopicMasteryModel> {
  return topicMasteryRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TopicMasteryModel>): Promise<TopicMasteryModel> {
  return topicMasteryRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TopicMasteryId, data: Partial<TopicMasteryModel>): Promise<TopicMasteryModel> {
  return topicMasteryRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: TopicMasteryId): Promise<void> {
  return topicMasteryRepository.remove(id);
}

export const topicMasteryService: TopicMasteryService = { get, create, update, remove };
