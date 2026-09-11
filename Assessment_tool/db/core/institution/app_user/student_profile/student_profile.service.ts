import type { StudentProfile } from "./student_profile.model.js";
import type { StudentProfileId } from "./student_profile.repository.js";
import { studentProfileRepository } from "./student_profile.repository.js";
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
export interface StudentProfileService {
  get(id: StudentProfileId): Promise<StudentProfile>;
  create(data: Partial<StudentProfile>): Promise<StudentProfile>;
  update(id: StudentProfileId, data: Partial<StudentProfile>): Promise<StudentProfile>;
  remove(id: StudentProfileId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: StudentProfileId): Promise<StudentProfile> {
  return studentProfileRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<StudentProfile>): Promise<StudentProfile> {
  return studentProfileRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: StudentProfileId, data: Partial<StudentProfile>): Promise<StudentProfile> {
  return studentProfileRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: StudentProfileId): Promise<void> {
  return studentProfileRepository.remove(id);
}

export const studentProfileService: StudentProfileService = { get, create, update, remove };
