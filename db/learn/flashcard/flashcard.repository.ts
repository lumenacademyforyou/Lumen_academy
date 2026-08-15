import type { FlashcardModel } from "./flashcard.model.js";
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

export type FlashcardId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "flashcard",
  entityLabel: "learn.flashcard",
  pkColumns: ["flashcard_id"],
};

export interface FlashcardRepository {
  findById(id: FlashcardId): Promise<FlashcardModel>;
  create(data: Partial<FlashcardModel>): Promise<FlashcardModel>;
  update(id: FlashcardId, data: Partial<FlashcardModel>): Promise<FlashcardModel>;
  remove(id: FlashcardId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: FlashcardId): Promise<FlashcardModel> {
  return findByIdImpl<FlashcardModel>(SPEC, { flashcard_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<FlashcardModel>): Promise<FlashcardModel> {
  return insertRow<FlashcardModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: FlashcardId, data: Partial<FlashcardModel>): Promise<FlashcardModel> {
  return updateByIdImpl<FlashcardModel>(SPEC, { flashcard_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: FlashcardId): Promise<void> {
  return deleteByIdImpl(SPEC, { flashcard_id: id });
}

export const flashcardRepository: FlashcardRepository = { findById, create, update, remove };
