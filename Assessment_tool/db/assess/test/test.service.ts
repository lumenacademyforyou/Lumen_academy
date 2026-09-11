import type { TestModel } from "./test.model.js";
import type { TestId } from "./test.repository.js";
import { testRepository } from "./test.repository.js";
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
export interface TestService {
  get(id: TestId): Promise<TestModel>;
  create(data: Partial<TestModel>): Promise<TestModel>;
  update(id: TestId, data: Partial<TestModel>): Promise<TestModel>;
  remove(id: TestId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: TestId): Promise<TestModel> {
  return testRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TestModel>): Promise<TestModel> {
  return testRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TestId, data: Partial<TestModel>): Promise<TestModel> {
  return testRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: TestId): Promise<void> {
  return testRepository.remove(id);
}

export const testService: TestService = { get, create, update, remove };
