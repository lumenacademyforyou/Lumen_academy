import type { QuestionChunkRefModel } from "./question_chunk_ref.model.js";
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

export interface QuestionChunkRefId {
  question_id: string;
  chunk_id: string;
  [key: string]: string;
}

const SPEC: TableSpec = {
  schema: "content",
  table: "question_chunk_ref",
  entityLabel: "content.question_chunk_ref",
  pkColumns: ["question_id", "chunk_id"],
};

export interface QuestionChunkRefRepository {
  findById(id: QuestionChunkRefId): Promise<QuestionChunkRefModel>;
  create(data: Partial<QuestionChunkRefModel>): Promise<QuestionChunkRefModel>;
  update(id: QuestionChunkRefId, data: Partial<QuestionChunkRefModel>): Promise<QuestionChunkRefModel>;
  remove(id: QuestionChunkRefId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: QuestionChunkRefId): Promise<QuestionChunkRefModel> {
  return findByIdImpl<QuestionChunkRefModel>(SPEC, id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionChunkRefModel>): Promise<QuestionChunkRefModel> {
  return insertRow<QuestionChunkRefModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionChunkRefId, data: Partial<QuestionChunkRefModel>): Promise<QuestionChunkRefModel> {
  return updateByIdImpl<QuestionChunkRefModel>(SPEC, id, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: QuestionChunkRefId): Promise<void> {
  return deleteByIdImpl(SPEC, id);
}

export const questionChunkRefRepository: QuestionChunkRefRepository = { findById, create, update, remove };
