import type { SyllabusVersionModel } from "./syllabus_version.model.js";
import type { SyllabusVersionId } from "./syllabus_version.repository.js";
import { syllabusVersionRepository } from "./syllabus_version.repository.js";
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
export interface SyllabusVersionService {
  get(id: SyllabusVersionId): Promise<SyllabusVersionModel>;
  create(data: Partial<SyllabusVersionModel>): Promise<SyllabusVersionModel>;
  update(id: SyllabusVersionId, data: Partial<SyllabusVersionModel>): Promise<SyllabusVersionModel>;
  remove(id: SyllabusVersionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: SyllabusVersionId): Promise<SyllabusVersionModel> {
  return syllabusVersionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SyllabusVersionModel>): Promise<SyllabusVersionModel> {
  return syllabusVersionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SyllabusVersionId, data: Partial<SyllabusVersionModel>): Promise<SyllabusVersionModel> {
  return syllabusVersionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: SyllabusVersionId): Promise<void> {
  return syllabusVersionRepository.remove(id);
}

export const syllabusVersionService: SyllabusVersionService = { get, create, update, remove };
