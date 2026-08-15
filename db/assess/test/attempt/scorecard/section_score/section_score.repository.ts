import type { SectionScoreModel } from "./section_score.model.js";
import {
  findById as findByIdImpl,
  insertRow,
  updateById as updateByIdImpl,
  deleteById as deleteByIdImpl,
  type TableSpec,
} from "../../../../../shared/repository-helpers.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../../../shared/errors.js";

export type SectionScoreId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "section_score",
  entityLabel: "assess.section_score",
  pkColumns: ["section_score_id"],
};

export interface SectionScoreRepository {
  findById(id: SectionScoreId): Promise<SectionScoreModel>;
  create(data: Partial<SectionScoreModel>): Promise<SectionScoreModel>;
  update(id: SectionScoreId, data: Partial<SectionScoreModel>): Promise<SectionScoreModel>;
  remove(id: SectionScoreId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: SectionScoreId): Promise<SectionScoreModel> {
  return findByIdImpl<SectionScoreModel>(SPEC, { section_score_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SectionScoreModel>): Promise<SectionScoreModel> {
  return insertRow<SectionScoreModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SectionScoreId, data: Partial<SectionScoreModel>): Promise<SectionScoreModel> {
  return updateByIdImpl<SectionScoreModel>(SPEC, { section_score_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: SectionScoreId): Promise<void> {
  return deleteByIdImpl(SPEC, { section_score_id: id });
}

export const sectionScoreRepository: SectionScoreRepository = { findById, create, update, remove };
