import type { FlashcardModel } from "./flashcard.model.js";
import type { FlashcardId } from "./flashcard.repository.js";
import { flashcardRepository } from "./flashcard.repository.js";
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
export interface FlashcardService {
  get(id: FlashcardId): Promise<FlashcardModel>;
  create(data: Partial<FlashcardModel>): Promise<FlashcardModel>;
  update(id: FlashcardId, data: Partial<FlashcardModel>): Promise<FlashcardModel>;
  remove(id: FlashcardId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: FlashcardId): Promise<FlashcardModel> {
  return flashcardRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<FlashcardModel>): Promise<FlashcardModel> {
  return flashcardRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: FlashcardId, data: Partial<FlashcardModel>): Promise<FlashcardModel> {
  return flashcardRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: FlashcardId): Promise<void> {
  return flashcardRepository.remove(id);
}

export const flashcardService: FlashcardService = { get, create, update, remove };
