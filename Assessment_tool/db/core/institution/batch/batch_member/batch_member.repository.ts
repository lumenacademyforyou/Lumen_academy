import type { BatchMemberModel } from "./batch_member.model.js";
import {
  findById as findByIdImpl,
  insertRow,
  updateById as updateByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../../../shared/repository-helpers.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../../shared/errors.js";

export interface BatchMemberId {
  batch_id: string;
  user_id: string;
  [key: string]: string;
}

const SPEC: TableSpec = {
  schema: "core",
  table: "batch_member",
  entityLabel: "core.batch_member",
  pkColumns: ["batch_id", "user_id"],
};

export interface BatchMemberRepository {
  findById(id: BatchMemberId): Promise<BatchMemberModel>;
  create(data: Partial<BatchMemberModel>): Promise<BatchMemberModel>;
  update(id: BatchMemberId, data: Partial<BatchMemberModel>): Promise<BatchMemberModel>;
  remove(id: BatchMemberId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: BatchMemberId): Promise<BatchMemberModel> {
  return findByIdImpl<BatchMemberModel>(SPEC, id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<BatchMemberModel>): Promise<BatchMemberModel> {
  return insertRow<BatchMemberModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: BatchMemberId, data: Partial<BatchMemberModel>): Promise<BatchMemberModel> {
  return updateByIdImpl<BatchMemberModel>(SPEC, id, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: BatchMemberId): Promise<void> {
  return deleteByIdImpl(SPEC, id);
}

export const batchMemberRepository: BatchMemberRepository = { findById, create, update, remove };
