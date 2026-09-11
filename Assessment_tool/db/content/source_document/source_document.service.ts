import type { SourceDocumentModel } from "./source_document.model.js";
import type { SourceDocumentId } from "./source_document.repository.js";
import { sourceDocumentRepository } from "./source_document.repository.js";
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
export interface SourceDocumentService {
  get(id: SourceDocumentId): Promise<SourceDocumentModel>;
  create(data: Partial<SourceDocumentModel>): Promise<SourceDocumentModel>;
  update(id: SourceDocumentId, data: Partial<SourceDocumentModel>): Promise<SourceDocumentModel>;
  remove(id: SourceDocumentId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: SourceDocumentId): Promise<SourceDocumentModel> {
  return sourceDocumentRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SourceDocumentModel>): Promise<SourceDocumentModel> {
  return sourceDocumentRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SourceDocumentId, data: Partial<SourceDocumentModel>): Promise<SourceDocumentModel> {
  return sourceDocumentRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: SourceDocumentId): Promise<void> {
  return sourceDocumentRepository.remove(id);
}

export const sourceDocumentService: SourceDocumentService = { get, create, update, remove };
