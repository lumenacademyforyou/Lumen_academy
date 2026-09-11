import type { MarkingSchemeModel } from "./marking_scheme.model.js";
import type { MarkingSchemeId } from "./marking_scheme.repository.js";
import { markingSchemeRepository } from "./marking_scheme.repository.js";
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
export interface MarkingSchemeService {
  get(id: MarkingSchemeId): Promise<MarkingSchemeModel>;
  create(data: Partial<MarkingSchemeModel>): Promise<MarkingSchemeModel>;
  update(id: MarkingSchemeId, data: Partial<MarkingSchemeModel>): Promise<MarkingSchemeModel>;
  remove(id: MarkingSchemeId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: MarkingSchemeId): Promise<MarkingSchemeModel> {
  return markingSchemeRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<MarkingSchemeModel>): Promise<MarkingSchemeModel> {
  return markingSchemeRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: MarkingSchemeId, data: Partial<MarkingSchemeModel>): Promise<MarkingSchemeModel> {
  return markingSchemeRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: MarkingSchemeId): Promise<void> {
  return markingSchemeRepository.remove(id);
}

export const markingSchemeService: MarkingSchemeService = { get, create, update, remove };
