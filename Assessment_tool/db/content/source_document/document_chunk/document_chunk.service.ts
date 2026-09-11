import type { DocumentChunkModel } from "./document_chunk.model.js";
import type { DocumentChunkId } from "./document_chunk.repository.js";
import { documentChunkRepository } from "./document_chunk.repository.js";
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
export interface DocumentChunkService {
  get(id: DocumentChunkId): Promise<DocumentChunkModel>;
  create(data: Partial<DocumentChunkModel>): Promise<DocumentChunkModel>;
  update(id: DocumentChunkId, data: Partial<DocumentChunkModel>): Promise<DocumentChunkModel>;
  remove(id: DocumentChunkId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: DocumentChunkId): Promise<DocumentChunkModel> {
  return documentChunkRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<DocumentChunkModel>): Promise<DocumentChunkModel> {
  return documentChunkRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: DocumentChunkId, data: Partial<DocumentChunkModel>): Promise<DocumentChunkModel> {
  return documentChunkRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: DocumentChunkId): Promise<void> {
  return documentChunkRepository.remove(id);
}

export const documentChunkService: DocumentChunkService = { get, create, update, remove };
