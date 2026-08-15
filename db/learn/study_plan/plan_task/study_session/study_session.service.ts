import type { StudySessionModel } from "./study_session.model.js";
import type { StudySessionId } from "./study_session.repository.js";
import { studySessionRepository } from "./study_session.repository.js";
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
export interface StudySessionService {
  get(id: StudySessionId): Promise<StudySessionModel>;
  create(data: Partial<StudySessionModel>): Promise<StudySessionModel>;
  update(id: StudySessionId, data: Partial<StudySessionModel>): Promise<StudySessionModel>;
  remove(id: StudySessionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: StudySessionId): Promise<StudySessionModel> {
  return studySessionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<StudySessionModel>): Promise<StudySessionModel> {
  return studySessionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: StudySessionId, data: Partial<StudySessionModel>): Promise<StudySessionModel> {
  return studySessionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: StudySessionId): Promise<void> {
  return studySessionRepository.remove(id);
}

export const studySessionService: StudySessionService = { get, create, update, remove };
