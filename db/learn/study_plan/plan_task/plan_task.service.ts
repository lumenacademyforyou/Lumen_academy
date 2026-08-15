import type { PlanTaskModel } from "./plan_task.model.js";
import type { PlanTaskId } from "./plan_task.repository.js";
import { planTaskRepository } from "./plan_task.repository.js";
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
export interface PlanTaskService {
  get(id: PlanTaskId): Promise<PlanTaskModel>;
  create(data: Partial<PlanTaskModel>): Promise<PlanTaskModel>;
  update(id: PlanTaskId, data: Partial<PlanTaskModel>): Promise<PlanTaskModel>;
  remove(id: PlanTaskId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: PlanTaskId): Promise<PlanTaskModel> {
  return planTaskRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<PlanTaskModel>): Promise<PlanTaskModel> {
  return planTaskRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: PlanTaskId, data: Partial<PlanTaskModel>): Promise<PlanTaskModel> {
  return planTaskRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: PlanTaskId): Promise<void> {
  return planTaskRepository.remove(id);
}

export const planTaskService: PlanTaskService = { get, create, update, remove };
