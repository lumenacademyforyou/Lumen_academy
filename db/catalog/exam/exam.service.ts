import type { ExamModel } from "./exam.model.js";
import type { ExamId } from "./exam.repository.js";
import { examRepository } from "./exam.repository.js";
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
export interface ExamService {
  get(id: ExamId): Promise<ExamModel>;
  create(data: Partial<ExamModel>): Promise<ExamModel>;
  update(id: ExamId, data: Partial<ExamModel>): Promise<ExamModel>;
  remove(id: ExamId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: ExamId): Promise<ExamModel> {
  return examRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ExamModel>): Promise<ExamModel> {
  return examRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ExamId, data: Partial<ExamModel>): Promise<ExamModel> {
  return examRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: ExamId): Promise<void> {
  return examRepository.remove(id);
}

export const examService: ExamService = { get, create, update, remove };
