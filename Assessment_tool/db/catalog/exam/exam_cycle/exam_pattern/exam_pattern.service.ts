import type { ExamPatternModel } from "./exam_pattern.model.js";
import type { ExamPatternId } from "./exam_pattern.repository.js";
import { examPatternRepository } from "./exam_pattern.repository.js";
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
export interface ExamPatternService {
  get(id: ExamPatternId): Promise<ExamPatternModel>;
  create(data: Partial<ExamPatternModel>): Promise<ExamPatternModel>;
  update(id: ExamPatternId, data: Partial<ExamPatternModel>): Promise<ExamPatternModel>;
  remove(id: ExamPatternId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: ExamPatternId): Promise<ExamPatternModel> {
  return examPatternRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ExamPatternModel>): Promise<ExamPatternModel> {
  return examPatternRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ExamPatternId, data: Partial<ExamPatternModel>): Promise<ExamPatternModel> {
  return examPatternRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: ExamPatternId): Promise<void> {
  return examPatternRepository.remove(id);
}

export const examPatternService: ExamPatternService = { get, create, update, remove };
