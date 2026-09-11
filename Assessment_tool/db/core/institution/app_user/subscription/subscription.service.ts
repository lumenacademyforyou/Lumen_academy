import type { SubscriptionModel } from "./subscription.model.js";
import type { SubscriptionId } from "./subscription.repository.js";
import { subscriptionRepository } from "./subscription.repository.js";
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
export interface SubscriptionService {
  get(id: SubscriptionId): Promise<SubscriptionModel>;
  create(data: Partial<SubscriptionModel>): Promise<SubscriptionModel>;
  update(id: SubscriptionId, data: Partial<SubscriptionModel>): Promise<SubscriptionModel>;
  remove(id: SubscriptionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: SubscriptionId): Promise<SubscriptionModel> {
  return subscriptionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SubscriptionModel>): Promise<SubscriptionModel> {
  return subscriptionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SubscriptionId, data: Partial<SubscriptionModel>): Promise<SubscriptionModel> {
  return subscriptionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: SubscriptionId): Promise<void> {
  return subscriptionRepository.remove(id);
}

export const subscriptionService: SubscriptionService = { get, create, update, remove };
