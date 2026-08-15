import type { QuestionSolutionModel } from "./question_solution.model.js";
import type { QuestionSolutionId } from "./question_solution.repository.js";
import { questionSolutionRepository } from "./question_solution.repository.js";
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
export interface QuestionSolutionService {
  get(id: QuestionSolutionId): Promise<QuestionSolutionModel>;
  create(data: Partial<QuestionSolutionModel>): Promise<QuestionSolutionModel>;
  update(id: QuestionSolutionId, data: Partial<QuestionSolutionModel>): Promise<QuestionSolutionModel>;
  remove(id: QuestionSolutionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: QuestionSolutionId): Promise<QuestionSolutionModel> {
  return questionSolutionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionSolutionModel>): Promise<QuestionSolutionModel> {
  return questionSolutionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionSolutionId, data: Partial<QuestionSolutionModel>): Promise<QuestionSolutionModel> {
  return questionSolutionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: QuestionSolutionId): Promise<void> {
  return questionSolutionRepository.remove(id);
}

export const questionSolutionService: QuestionSolutionService = { get, create, update, remove };
