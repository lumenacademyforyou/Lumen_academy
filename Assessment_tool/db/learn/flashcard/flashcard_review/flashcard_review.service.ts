import type { FlashcardReviewModel } from "./flashcard_review.model.js";
import type { FlashcardReviewId } from "./flashcard_review.repository.js";
import { flashcardReviewRepository } from "./flashcard_review.repository.js";
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
export interface FlashcardReviewService {
  get(id: FlashcardReviewId): Promise<FlashcardReviewModel>;
  create(data: Partial<FlashcardReviewModel>): Promise<FlashcardReviewModel>;
  update(id: FlashcardReviewId, data: Partial<FlashcardReviewModel>): Promise<FlashcardReviewModel>;
  remove(id: FlashcardReviewId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: FlashcardReviewId): Promise<FlashcardReviewModel> {
  return flashcardReviewRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<FlashcardReviewModel>): Promise<FlashcardReviewModel> {
  return flashcardReviewRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: FlashcardReviewId, data: Partial<FlashcardReviewModel>): Promise<FlashcardReviewModel> {
  return flashcardReviewRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: FlashcardReviewId): Promise<void> {
  return flashcardReviewRepository.remove(id);
}

export const flashcardReviewService: FlashcardReviewService = { get, create, update, remove };
