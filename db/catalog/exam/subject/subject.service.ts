import type { SubjectModel } from "./subject.model.js";
import type { SubjectId } from "./subject.repository.js";
import { subjectRepository } from "./subject.repository.js";
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
export interface SubjectService {
  get(id: SubjectId): Promise<SubjectModel>;
  create(data: Partial<SubjectModel>): Promise<SubjectModel>;
  update(id: SubjectId, data: Partial<SubjectModel>): Promise<SubjectModel>;
  remove(id: SubjectId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: SubjectId): Promise<SubjectModel> {
  return subjectRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SubjectModel>): Promise<SubjectModel> {
  return subjectRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SubjectId, data: Partial<SubjectModel>): Promise<SubjectModel> {
  return subjectRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: SubjectId): Promise<void> {
  return subjectRepository.remove(id);
}

export const subjectService: SubjectService = { get, create, update, remove };
