import type { ErrorLogModel } from "./error_log.model.js";
import type { ErrorLogId } from "./error_log.repository.js";
import { errorLogRepository } from "./error_log.repository.js";
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
export interface ErrorLogService {
  get(id: ErrorLogId): Promise<ErrorLogModel>;
  create(data: Partial<ErrorLogModel>): Promise<ErrorLogModel>;
  update(id: ErrorLogId, data: Partial<ErrorLogModel>): Promise<ErrorLogModel>;
  remove(id: ErrorLogId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: ErrorLogId): Promise<ErrorLogModel> {
  return errorLogRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ErrorLogModel>): Promise<ErrorLogModel> {
  return errorLogRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ErrorLogId, data: Partial<ErrorLogModel>): Promise<ErrorLogModel> {
  return errorLogRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: ErrorLogId): Promise<void> {
  return errorLogRepository.remove(id);
}

export const errorLogService: ErrorLogService = { get, create, update, remove };
