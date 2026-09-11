import type { AuditLogModel } from "./audit_log.model.js";
import {
  findById as findByIdImpl,
  insertRow,
  updateById as updateByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../shared/repository-helpers.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../shared/errors.js";

export type AuditLogId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "audit_log",
  entityLabel: "learn.audit_log",
  pkColumns: ["audit_id"],
};

export interface AuditLogRepository {
  findById(id: AuditLogId): Promise<AuditLogModel>;
  create(data: Partial<AuditLogModel>): Promise<AuditLogModel>;
  update(id: AuditLogId, data: Partial<AuditLogModel>): Promise<AuditLogModel>;
  remove(id: AuditLogId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: AuditLogId): Promise<AuditLogModel> {
  return findByIdImpl<AuditLogModel>(SPEC, { audit_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AuditLogModel>): Promise<AuditLogModel> {
  return insertRow<AuditLogModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AuditLogId, data: Partial<AuditLogModel>): Promise<AuditLogModel> {
  return updateByIdImpl<AuditLogModel>(SPEC, { audit_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: AuditLogId): Promise<void> {
  return deleteByIdImpl(SPEC, { audit_id: id });
}

export const auditLogRepository: AuditLogRepository = { findById, create, update, remove };
