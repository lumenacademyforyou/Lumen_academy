import type { SectionScoreModel } from "./section_score.model.js";
import type { SectionScoreId } from "./section_score.repository.js";
import { sectionScoreRepository } from "./section_score.repository.js";
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
export interface SectionScoreService {
  get(id: SectionScoreId): Promise<SectionScoreModel>;
  create(data: Partial<SectionScoreModel>): Promise<SectionScoreModel>;
  update(id: SectionScoreId, data: Partial<SectionScoreModel>): Promise<SectionScoreModel>;
  remove(id: SectionScoreId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: SectionScoreId): Promise<SectionScoreModel> {
  return sectionScoreRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SectionScoreModel>): Promise<SectionScoreModel> {
  return sectionScoreRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SectionScoreId, data: Partial<SectionScoreModel>): Promise<SectionScoreModel> {
  return sectionScoreRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: SectionScoreId): Promise<void> {
  return sectionScoreRepository.remove(id);
}

export const sectionScoreService: SectionScoreService = { get, create, update, remove };
