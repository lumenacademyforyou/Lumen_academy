import type { TestAssignmentModel } from "./test_assignment.model.js";
import type { TestAssignmentId } from "./test_assignment.repository.js";
import { testAssignmentRepository } from "./test_assignment.repository.js";
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
export interface TestAssignmentService {
  get(id: TestAssignmentId): Promise<TestAssignmentModel>;
  create(data: Partial<TestAssignmentModel>): Promise<TestAssignmentModel>;
  update(id: TestAssignmentId, data: Partial<TestAssignmentModel>): Promise<TestAssignmentModel>;
  remove(id: TestAssignmentId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: TestAssignmentId): Promise<TestAssignmentModel> {
  return testAssignmentRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TestAssignmentModel>): Promise<TestAssignmentModel> {
  return testAssignmentRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TestAssignmentId, data: Partial<TestAssignmentModel>): Promise<TestAssignmentModel> {
  return testAssignmentRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: TestAssignmentId): Promise<void> {
  return testAssignmentRepository.remove(id);
}

export const testAssignmentService: TestAssignmentService = { get, create, update, remove };
