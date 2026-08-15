import type { QuestionTranslationModel } from "./question_translation.model.js";
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

export type QuestionTranslationId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "question_translation",
  entityLabel: "content.question_translation",
  pkColumns: ["translation_id"],
};

export interface QuestionTranslationRepository {
  findById(id: QuestionTranslationId): Promise<QuestionTranslationModel>;
  create(data: Partial<QuestionTranslationModel>): Promise<QuestionTranslationModel>;
  update(id: QuestionTranslationId, data: Partial<QuestionTranslationModel>): Promise<QuestionTranslationModel>;
  remove(id: QuestionTranslationId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: QuestionTranslationId): Promise<QuestionTranslationModel> {
  return findByIdImpl<QuestionTranslationModel>(SPEC, { translation_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionTranslationModel>): Promise<QuestionTranslationModel> {
  return insertRow<QuestionTranslationModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionTranslationId, data: Partial<QuestionTranslationModel>): Promise<QuestionTranslationModel> {
  return updateByIdImpl<QuestionTranslationModel>(SPEC, { translation_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: QuestionTranslationId): Promise<void> {
  return deleteByIdImpl(SPEC, { translation_id: id });
}

export const questionTranslationRepository: QuestionTranslationRepository = { findById, create, update, remove };
