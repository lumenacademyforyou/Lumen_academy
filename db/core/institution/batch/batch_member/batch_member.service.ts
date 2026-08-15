import type { BatchMemberModel } from "./batch_member.model.js";
import type { BatchMemberId } from "./batch_member.repository.js";
import { batchMemberRepository } from "./batch_member.repository.js";
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
export interface BatchMemberService {
  get(id: BatchMemberId): Promise<BatchMemberModel>;
  create(data: Partial<BatchMemberModel>): Promise<BatchMemberModel>;
  update(id: BatchMemberId, data: Partial<BatchMemberModel>): Promise<BatchMemberModel>;
  remove(id: BatchMemberId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: BatchMemberId): Promise<BatchMemberModel> {
  return batchMemberRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<BatchMemberModel>): Promise<BatchMemberModel> {
  return batchMemberRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: BatchMemberId, data: Partial<BatchMemberModel>): Promise<BatchMemberModel> {
  return batchMemberRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: BatchMemberId): Promise<void> {
  return batchMemberRepository.remove(id);
}

export const batchMemberService: BatchMemberService = { get, create, update, remove };
