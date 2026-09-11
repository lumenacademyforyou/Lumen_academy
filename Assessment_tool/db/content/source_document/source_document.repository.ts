import type { SourceDocumentModel } from "./source_document.model.js";
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

export type SourceDocumentId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "source_document",
  entityLabel: "content.source_document",
  pkColumns: ["document_id"],
};

export interface SourceDocumentRepository {
  findById(id: SourceDocumentId): Promise<SourceDocumentModel>;
  create(data: Partial<SourceDocumentModel>): Promise<SourceDocumentModel>;
  update(id: SourceDocumentId, data: Partial<SourceDocumentModel>): Promise<SourceDocumentModel>;
  remove(id: SourceDocumentId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: SourceDocumentId): Promise<SourceDocumentModel> {
  return findByIdImpl<SourceDocumentModel>(SPEC, { document_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SourceDocumentModel>): Promise<SourceDocumentModel> {
  return insertRow<SourceDocumentModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SourceDocumentId, data: Partial<SourceDocumentModel>): Promise<SourceDocumentModel> {
  return updateByIdImpl<SourceDocumentModel>(SPEC, { document_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: SourceDocumentId): Promise<void> {
  return deleteByIdImpl(SPEC, { document_id: id });
}

export const sourceDocumentRepository: SourceDocumentRepository = { findById, create, update, remove };
