import type { QuestionReviewModel } from "./question_review.model.js";
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

export type QuestionReviewId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "question_review",
  entityLabel: "content.question_review",
  pkColumns: ["review_id"],
};

export interface QuestionReviewRepository {
  findById(id: QuestionReviewId): Promise<QuestionReviewModel>;
  create(data: Partial<QuestionReviewModel>): Promise<QuestionReviewModel>;
  update(id: QuestionReviewId, data: Partial<QuestionReviewModel>): Promise<QuestionReviewModel>;
  remove(id: QuestionReviewId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: QuestionReviewId): Promise<QuestionReviewModel> {
  return findByIdImpl<QuestionReviewModel>(SPEC, { review_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionReviewModel>): Promise<QuestionReviewModel> {
  return insertRow<QuestionReviewModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionReviewId, data: Partial<QuestionReviewModel>): Promise<QuestionReviewModel> {
  return updateByIdImpl<QuestionReviewModel>(SPEC, { review_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: QuestionReviewId): Promise<void> {
  return deleteByIdImpl(SPEC, { review_id: id });
}

export const questionReviewRepository: QuestionReviewRepository = { findById, create, update, remove };
