import type { QuestionTranslationModel } from "./question_translation.model.js";
import type { QuestionTranslationId } from "./question_translation.repository.js";
import { questionTranslationRepository } from "./question_translation.repository.js";
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
export interface QuestionTranslationService {
  get(id: QuestionTranslationId): Promise<QuestionTranslationModel>;
  create(data: Partial<QuestionTranslationModel>): Promise<QuestionTranslationModel>;
  update(id: QuestionTranslationId, data: Partial<QuestionTranslationModel>): Promise<QuestionTranslationModel>;
  remove(id: QuestionTranslationId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: QuestionTranslationId): Promise<QuestionTranslationModel> {
  return questionTranslationRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionTranslationModel>): Promise<QuestionTranslationModel> {
  return questionTranslationRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionTranslationId, data: Partial<QuestionTranslationModel>): Promise<QuestionTranslationModel> {
  return questionTranslationRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: QuestionTranslationId): Promise<void> {
  return questionTranslationRepository.remove(id);
}

export const questionTranslationService: QuestionTranslationService = { get, create, update, remove };
