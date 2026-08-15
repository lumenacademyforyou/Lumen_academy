import type { QuestionReviewModel } from "./question_review.model.js";
import type { QuestionReviewId } from "./question_review.repository.js";
import { questionReviewRepository } from "./question_review.repository.js";
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
export interface QuestionReviewService {
  get(id: QuestionReviewId): Promise<QuestionReviewModel>;
  create(data: Partial<QuestionReviewModel>): Promise<QuestionReviewModel>;
  update(id: QuestionReviewId, data: Partial<QuestionReviewModel>): Promise<QuestionReviewModel>;
  remove(id: QuestionReviewId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: QuestionReviewId): Promise<QuestionReviewModel> {
  return questionReviewRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionReviewModel>): Promise<QuestionReviewModel> {
  return questionReviewRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionReviewId, data: Partial<QuestionReviewModel>): Promise<QuestionReviewModel> {
  return questionReviewRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: QuestionReviewId): Promise<void> {
  return questionReviewRepository.remove(id);
}

export const questionReviewService: QuestionReviewService = { get, create, update, remove };
