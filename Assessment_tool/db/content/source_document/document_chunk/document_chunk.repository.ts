import type { DocumentChunkModel } from "./document_chunk.model.js";
import {
  findById as findByIdImpl,
  insertRow,
  updateById as updateByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../../shared/repository-helpers.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../shared/errors.js";

export type DocumentChunkId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "document_chunk",
  entityLabel: "content.document_chunk",
  pkColumns: ["chunk_id"],
};

export interface DocumentChunkRepository {
  findById(id: DocumentChunkId): Promise<DocumentChunkModel>;
  create(data: Partial<DocumentChunkModel>): Promise<DocumentChunkModel>;
  update(id: DocumentChunkId, data: Partial<DocumentChunkModel>): Promise<DocumentChunkModel>;
  remove(id: DocumentChunkId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: DocumentChunkId): Promise<DocumentChunkModel> {
  return findByIdImpl<DocumentChunkModel>(SPEC, { chunk_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<DocumentChunkModel>): Promise<DocumentChunkModel> {
  return insertRow<DocumentChunkModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: DocumentChunkId, data: Partial<DocumentChunkModel>): Promise<DocumentChunkModel> {
  return updateByIdImpl<DocumentChunkModel>(SPEC, { chunk_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: DocumentChunkId): Promise<void> {
  return deleteByIdImpl(SPEC, { chunk_id: id });
}

export const documentChunkRepository: DocumentChunkRepository = { findById, create, update, remove };
