import type { SubscriptionPlanModel } from "./subscription_plan.model.js";
import type { SubscriptionPlanId } from "./subscription_plan.repository.js";
import { subscriptionPlanRepository } from "./subscription_plan.repository.js";
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
export interface SubscriptionPlanService {
  get(id: SubscriptionPlanId): Promise<SubscriptionPlanModel>;
  create(data: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel>;
  update(id: SubscriptionPlanId, data: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel>;
  remove(id: SubscriptionPlanId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: SubscriptionPlanId): Promise<SubscriptionPlanModel> {
  return subscriptionPlanRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel> {
  return subscriptionPlanRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SubscriptionPlanId, data: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel> {
  return subscriptionPlanRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: SubscriptionPlanId): Promise<void> {
  return subscriptionPlanRepository.remove(id);
}

export const subscriptionPlanService: SubscriptionPlanService = { get, create, update, remove };
