import type { EducatorProfileModel } from "./educator_profile.model.js";
import type { EducatorProfileId } from "./educator_profile.repository.js";
import { educatorProfileRepository } from "./educator_profile.repository.js";
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
export interface EducatorProfileService {
  get(id: EducatorProfileId): Promise<EducatorProfileModel>;
  create(data: Partial<EducatorProfileModel>): Promise<EducatorProfileModel>;
  update(id: EducatorProfileId, data: Partial<EducatorProfileModel>): Promise<EducatorProfileModel>;
  remove(id: EducatorProfileId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: EducatorProfileId): Promise<EducatorProfileModel> {
  return educatorProfileRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<EducatorProfileModel>): Promise<EducatorProfileModel> {
  return educatorProfileRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: EducatorProfileId, data: Partial<EducatorProfileModel>): Promise<EducatorProfileModel> {
  return educatorProfileRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: EducatorProfileId): Promise<void> {
  return educatorProfileRepository.remove(id);
}

export const educatorProfileService: EducatorProfileService = { get, create, update, remove };
