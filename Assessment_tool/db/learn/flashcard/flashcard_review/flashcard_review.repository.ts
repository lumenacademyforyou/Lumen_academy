import type { FlashcardReviewModel } from "./flashcard_review.model.js";
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

export type FlashcardReviewId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "flashcard_review",
  entityLabel: "learn.flashcard_review",
  pkColumns: ["flashcard_review_id"],
};

export interface FlashcardReviewRepository {
  findById(id: FlashcardReviewId): Promise<FlashcardReviewModel>;
  create(data: Partial<FlashcardReviewModel>): Promise<FlashcardReviewModel>;
  update(id: FlashcardReviewId, data: Partial<FlashcardReviewModel>): Promise<FlashcardReviewModel>;
  remove(id: FlashcardReviewId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: FlashcardReviewId): Promise<FlashcardReviewModel> {
  return findByIdImpl<FlashcardReviewModel>(SPEC, { flashcard_review_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<FlashcardReviewModel>): Promise<FlashcardReviewModel> {
  return insertRow<FlashcardReviewModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: FlashcardReviewId, data: Partial<FlashcardReviewModel>): Promise<FlashcardReviewModel> {
  return updateByIdImpl<FlashcardReviewModel>(SPEC, { flashcard_review_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: FlashcardReviewId): Promise<void> {
  return deleteByIdImpl(SPEC, { flashcard_review_id: id });
}

export const flashcardReviewRepository: FlashcardReviewRepository = { findById, create, update, remove };
