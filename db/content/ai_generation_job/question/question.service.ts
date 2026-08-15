import type { QuestionModel } from "./question.model.js";
import type { QuestionId } from "./question.repository.js";
import { questionRepository } from "./question.repository.js";
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
export interface QuestionService {
  get(id: QuestionId): Promise<QuestionModel>;
  create(data: Partial<QuestionModel>): Promise<QuestionModel>;
  update(id: QuestionId, data: Partial<QuestionModel>): Promise<QuestionModel>;
  remove(id: QuestionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: QuestionId): Promise<QuestionModel> {
  return questionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionModel>): Promise<QuestionModel> {
  return questionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionId, data: Partial<QuestionModel>): Promise<QuestionModel> {
  return questionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: QuestionId): Promise<void> {
  return questionRepository.remove(id);
}

export const questionService: QuestionService = { get, create, update, remove };
