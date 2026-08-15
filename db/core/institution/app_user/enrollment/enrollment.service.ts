import type { EnrollmentModel } from "./enrollment.model.js";
import type { EnrollmentId } from "./enrollment.repository.js";
import { enrollmentRepository } from "./enrollment.repository.js";
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
export interface EnrollmentService {
  get(id: EnrollmentId): Promise<EnrollmentModel>;
  create(data: Partial<EnrollmentModel>): Promise<EnrollmentModel>;
  update(id: EnrollmentId, data: Partial<EnrollmentModel>): Promise<EnrollmentModel>;
  remove(id: EnrollmentId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: EnrollmentId): Promise<EnrollmentModel> {
  return enrollmentRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<EnrollmentModel>): Promise<EnrollmentModel> {
  return enrollmentRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: EnrollmentId, data: Partial<EnrollmentModel>): Promise<EnrollmentModel> {
  return enrollmentRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: EnrollmentId): Promise<void> {
  return enrollmentRepository.remove(id);
}

export const enrollmentService: EnrollmentService = { get, create, update, remove };
