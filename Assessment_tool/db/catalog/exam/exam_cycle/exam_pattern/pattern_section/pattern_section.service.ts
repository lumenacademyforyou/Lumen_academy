import type { PatternSectionModel } from "./pattern_section.model.js";
import type { PatternSectionId } from "./pattern_section.repository.js";
import { patternSectionRepository } from "./pattern_section.repository.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../../../shared/errors.js";

/**
 * Thin pass-through to the repository. No business rules (state-machine
 * validation, optimistic-concurrency checks) are implemented here — the
 * design pack doesn't specify them for this entity, and no version/updated_at
 * column exists yet to detect a concurrent write. InvalidStateTransitionError
 * and ConcurrentWriteError stay declared in db/shared/errors.ts for whichever
 * layer implements those rules later; this service does not throw them.
 */
export interface PatternSectionService {
  get(id: PatternSectionId): Promise<PatternSectionModel>;
  create(data: Partial<PatternSectionModel>): Promise<PatternSectionModel>;
  update(id: PatternSectionId, data: Partial<PatternSectionModel>): Promise<PatternSectionModel>;
  remove(id: PatternSectionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: PatternSectionId): Promise<PatternSectionModel> {
  return patternSectionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<PatternSectionModel>): Promise<PatternSectionModel> {
  return patternSectionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: PatternSectionId, data: Partial<PatternSectionModel>): Promise<PatternSectionModel> {
  return patternSectionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: PatternSectionId): Promise<void> {
  return patternSectionRepository.remove(id);
}

export const patternSectionService: PatternSectionService = { get, create, update, remove };
