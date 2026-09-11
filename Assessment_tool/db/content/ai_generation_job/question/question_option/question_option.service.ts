import type { QuestionOptionModel } from "./question_option.model.js";
import type { QuestionOptionId } from "./question_option.repository.js";
import { questionOptionRepository } from "./question_option.repository.js";
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
export interface QuestionOptionService {
  get(id: QuestionOptionId): Promise<QuestionOptionModel>;
  create(data: Partial<QuestionOptionModel>): Promise<QuestionOptionModel>;
  update(id: QuestionOptionId, data: Partial<QuestionOptionModel>): Promise<QuestionOptionModel>;
  remove(id: QuestionOptionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: QuestionOptionId): Promise<QuestionOptionModel> {
  return questionOptionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionOptionModel>): Promise<QuestionOptionModel> {
  return questionOptionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionOptionId, data: Partial<QuestionOptionModel>): Promise<QuestionOptionModel> {
  return questionOptionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: QuestionOptionId): Promise<void> {
  return questionOptionRepository.remove(id);
}

export const questionOptionService: QuestionOptionService = { get, create, update, remove };
