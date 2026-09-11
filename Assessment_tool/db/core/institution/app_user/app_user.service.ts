import type { AppUserModel } from "./app_user.model.js";
import type { AppUserId } from "./app_user.repository.js";
import { appUserRepository } from "./app_user.repository.js";
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
export interface AppUserService {
  get(id: AppUserId): Promise<AppUserModel>;
  create(data: Partial<AppUserModel>): Promise<AppUserModel>;
  update(id: AppUserId, data: Partial<AppUserModel>): Promise<AppUserModel>;
  remove(id: AppUserId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: AppUserId): Promise<AppUserModel> {
  return appUserRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AppUserModel>): Promise<AppUserModel> {
  return appUserRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AppUserId, data: Partial<AppUserModel>): Promise<AppUserModel> {
  return appUserRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: AppUserId): Promise<void> {
  return appUserRepository.remove(id);
}

export const appUserService: AppUserService = { get, create, update, remove };
