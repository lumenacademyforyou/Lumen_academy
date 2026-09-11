import type { TestQuestionModel } from "./test_question.model.js";
import type { TestQuestionId } from "./test_question.repository.js";
import { testQuestionRepository } from "./test_question.repository.js";
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
export interface TestQuestionService {
  get(id: TestQuestionId): Promise<TestQuestionModel>;
  create(data: Partial<TestQuestionModel>): Promise<TestQuestionModel>;
  update(id: TestQuestionId, data: Partial<TestQuestionModel>): Promise<TestQuestionModel>;
  remove(id: TestQuestionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: TestQuestionId): Promise<TestQuestionModel> {
  return testQuestionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TestQuestionModel>): Promise<TestQuestionModel> {
  return testQuestionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TestQuestionId, data: Partial<TestQuestionModel>): Promise<TestQuestionModel> {
  return testQuestionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: TestQuestionId): Promise<void> {
  return testQuestionRepository.remove(id);
}

export const testQuestionService: TestQuestionService = { get, create, update, remove };
