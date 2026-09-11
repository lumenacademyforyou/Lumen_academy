import type { ExamCycleModel } from "./exam_cycle.model.js";
import type { ExamCycleId } from "./exam_cycle.repository.js";
import { examCycleRepository } from "./exam_cycle.repository.js";
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
export interface ExamCycleService {
  get(id: ExamCycleId): Promise<ExamCycleModel>;
  create(data: Partial<ExamCycleModel>): Promise<ExamCycleModel>;
  update(id: ExamCycleId, data: Partial<ExamCycleModel>): Promise<ExamCycleModel>;
  remove(id: ExamCycleId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: ExamCycleId): Promise<ExamCycleModel> {
  return examCycleRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ExamCycleModel>): Promise<ExamCycleModel> {
  return examCycleRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ExamCycleId, data: Partial<ExamCycleModel>): Promise<ExamCycleModel> {
  return examCycleRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: ExamCycleId): Promise<void> {
  return examCycleRepository.remove(id);
}

export const examCycleService: ExamCycleService = { get, create, update, remove };
