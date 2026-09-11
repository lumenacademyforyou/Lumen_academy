import type { NodeWeightageModel } from "./node_weightage.model.js";
import type { NodeWeightageId } from "./node_weightage.repository.js";
import { nodeWeightageRepository } from "./node_weightage.repository.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../../../shared/errors.js";

/**
 * Thin pass-through to the repository. No business rules (state-machine
 * validation, optimistic-concurrency checks) are implemented here — the
 * design pack doesn't specify them for this entity, and no version/updated_at
 * column exists yet to detect a concurrent write. InvalidStateTransitionError
 * and ConcurrentWriteError stay declared in db/shared/errors.ts for whichever
 * layer implements those rules later; this service does not throw them.
 */
export interface NodeWeightageService {
  get(id: NodeWeightageId): Promise<NodeWeightageModel>;
  create(data: Partial<NodeWeightageModel>): Promise<NodeWeightageModel>;
  update(id: NodeWeightageId, data: Partial<NodeWeightageModel>): Promise<NodeWeightageModel>;
  remove(id: NodeWeightageId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: NodeWeightageId): Promise<NodeWeightageModel> {
  return nodeWeightageRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<NodeWeightageModel>): Promise<NodeWeightageModel> {
  return nodeWeightageRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: NodeWeightageId, data: Partial<NodeWeightageModel>): Promise<NodeWeightageModel> {
  return nodeWeightageRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: NodeWeightageId): Promise<void> {
  return nodeWeightageRepository.remove(id);
}

export const nodeWeightageService: NodeWeightageService = { get, create, update, remove };
