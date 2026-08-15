import type { QuestionChunkRefModel } from "./question_chunk_ref.model.js";
import type { QuestionChunkRefId } from "./question_chunk_ref.repository.js";
import { questionChunkRefRepository } from "./question_chunk_ref.repository.js";
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
export interface QuestionChunkRefService {
  get(id: QuestionChunkRefId): Promise<QuestionChunkRefModel>;
  create(data: Partial<QuestionChunkRefModel>): Promise<QuestionChunkRefModel>;
  update(id: QuestionChunkRefId, data: Partial<QuestionChunkRefModel>): Promise<QuestionChunkRefModel>;
  remove(id: QuestionChunkRefId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: QuestionChunkRefId): Promise<QuestionChunkRefModel> {
  return questionChunkRefRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionChunkRefModel>): Promise<QuestionChunkRefModel> {
  return questionChunkRefRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionChunkRefId, data: Partial<QuestionChunkRefModel>): Promise<QuestionChunkRefModel> {
  return questionChunkRefRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: QuestionChunkRefId): Promise<void> {
  return questionChunkRefRepository.remove(id);
}

export const questionChunkRefService: QuestionChunkRefService = { get, create, update, remove };
