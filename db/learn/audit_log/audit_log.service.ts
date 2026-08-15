import type { AuditLogModel } from "./audit_log.model.js";
import type { AuditLogId } from "./audit_log.repository.js";
import { auditLogRepository } from "./audit_log.repository.js";
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
export interface AuditLogService {
  get(id: AuditLogId): Promise<AuditLogModel>;
  create(data: Partial<AuditLogModel>): Promise<AuditLogModel>;
  update(id: AuditLogId, data: Partial<AuditLogModel>): Promise<AuditLogModel>;
  remove(id: AuditLogId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: AuditLogId): Promise<AuditLogModel> {
  return auditLogRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AuditLogModel>): Promise<AuditLogModel> {
  return auditLogRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AuditLogId, data: Partial<AuditLogModel>): Promise<AuditLogModel> {
  return auditLogRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: AuditLogId): Promise<void> {
  return auditLogRepository.remove(id);
}

export const auditLogService: AuditLogService = { get, create, update, remove };
