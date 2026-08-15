import type { NotificationModel } from "./notification.model.js";
import type { NotificationId } from "./notification.repository.js";
import { notificationRepository } from "./notification.repository.js";
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
export interface NotificationService {
  get(id: NotificationId): Promise<NotificationModel>;
  create(data: Partial<NotificationModel>): Promise<NotificationModel>;
  update(id: NotificationId, data: Partial<NotificationModel>): Promise<NotificationModel>;
  remove(id: NotificationId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: NotificationId): Promise<NotificationModel> {
  return notificationRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<NotificationModel>): Promise<NotificationModel> {
  return notificationRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: NotificationId, data: Partial<NotificationModel>): Promise<NotificationModel> {
  return notificationRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: NotificationId): Promise<void> {
  return notificationRepository.remove(id);
}

export const notificationService: NotificationService = { get, create, update, remove };
