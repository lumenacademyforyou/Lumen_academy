import type { PatternSectionModel } from "./pattern_section.model.js";
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

export type PatternSectionId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "pattern_section",
  entityLabel: "catalog.pattern_section",
  pkColumns: ["pattern_section_id"],
};

export interface PatternSectionRepository {
  findById(id: PatternSectionId): Promise<PatternSectionModel>;
  create(data: Partial<PatternSectionModel>): Promise<PatternSectionModel>;
  update(id: PatternSectionId, data: Partial<PatternSectionModel>): Promise<PatternSectionModel>;
  remove(id: PatternSectionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: PatternSectionId): Promise<PatternSectionModel> {
  return findByIdImpl<PatternSectionModel>(SPEC, { pattern_section_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<PatternSectionModel>): Promise<PatternSectionModel> {
  return insertRow<PatternSectionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: PatternSectionId, data: Partial<PatternSectionModel>): Promise<PatternSectionModel> {
  return updateByIdImpl<PatternSectionModel>(SPEC, { pattern_section_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: PatternSectionId): Promise<void> {
  return deleteByIdImpl(SPEC, { pattern_section_id: id });
}

export const patternSectionRepository: PatternSectionRepository = { findById, create, update, remove };
