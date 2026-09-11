import type { QuestionNodeMapModel } from "./question_node_map.model.js";
import type { QuestionNodeMapId } from "./question_node_map.repository.js";
import { questionNodeMapRepository } from "./question_node_map.repository.js";
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
export interface QuestionNodeMapService {
  get(id: QuestionNodeMapId): Promise<QuestionNodeMapModel>;
  create(data: Partial<QuestionNodeMapModel>): Promise<QuestionNodeMapModel>;
  update(id: QuestionNodeMapId, data: Partial<QuestionNodeMapModel>): Promise<QuestionNodeMapModel>;
  remove(id: QuestionNodeMapId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: QuestionNodeMapId): Promise<QuestionNodeMapModel> {
  return questionNodeMapRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionNodeMapModel>): Promise<QuestionNodeMapModel> {
  return questionNodeMapRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionNodeMapId, data: Partial<QuestionNodeMapModel>): Promise<QuestionNodeMapModel> {
  return questionNodeMapRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: QuestionNodeMapId): Promise<void> {
  return questionNodeMapRepository.remove(id);
}

export const questionNodeMapService: QuestionNodeMapService = { get, create, update, remove };
