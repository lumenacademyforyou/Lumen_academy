import type { TestSectionModel } from "./test_section.model.js";
import type { TestSectionId } from "./test_section.repository.js";
import { testSectionRepository } from "./test_section.repository.js";
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
export interface TestSectionService {
  get(id: TestSectionId): Promise<TestSectionModel>;
  create(data: Partial<TestSectionModel>): Promise<TestSectionModel>;
  update(id: TestSectionId, data: Partial<TestSectionModel>): Promise<TestSectionModel>;
  remove(id: TestSectionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: TestSectionId): Promise<TestSectionModel> {
  return testSectionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TestSectionModel>): Promise<TestSectionModel> {
  return testSectionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TestSectionId, data: Partial<TestSectionModel>): Promise<TestSectionModel> {
  return testSectionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: TestSectionId): Promise<void> {
  return testSectionRepository.remove(id);
}

export const testSectionService: TestSectionService = { get, create, update, remove };
