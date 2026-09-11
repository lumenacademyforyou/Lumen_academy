import type { QuestionNodeMapModel } from "./question_node_map.model.js";
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

export interface QuestionNodeMapId {
  question_id: string;
  node_id: string;
  [key: string]: string;
}

const SPEC: TableSpec = {
  schema: "content",
  table: "question_node_map",
  entityLabel: "content.question_node_map",
  pkColumns: ["question_id", "node_id"],
};

export interface QuestionNodeMapRepository {
  findById(id: QuestionNodeMapId): Promise<QuestionNodeMapModel>;
  create(data: Partial<QuestionNodeMapModel>): Promise<QuestionNodeMapModel>;
  update(id: QuestionNodeMapId, data: Partial<QuestionNodeMapModel>): Promise<QuestionNodeMapModel>;
  remove(id: QuestionNodeMapId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: QuestionNodeMapId): Promise<QuestionNodeMapModel> {
  return findByIdImpl<QuestionNodeMapModel>(SPEC, id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<QuestionNodeMapModel>): Promise<QuestionNodeMapModel> {
  return insertRow<QuestionNodeMapModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: QuestionNodeMapId, data: Partial<QuestionNodeMapModel>): Promise<QuestionNodeMapModel> {
  return updateByIdImpl<QuestionNodeMapModel>(SPEC, id, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: QuestionNodeMapId): Promise<void> {
  return deleteByIdImpl(SPEC, id);
}

export const questionNodeMapRepository: QuestionNodeMapRepository = { findById, create, update, remove };
