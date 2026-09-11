import type { MarkingSchemeModel } from "./marking_scheme.model.js";
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

export type MarkingSchemeId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "marking_scheme",
  entityLabel: "catalog.marking_scheme",
  pkColumns: ["scheme_id"],
};

export interface MarkingSchemeRepository {
  findById(id: MarkingSchemeId): Promise<MarkingSchemeModel>;
  create(data: Partial<MarkingSchemeModel>): Promise<MarkingSchemeModel>;
  update(id: MarkingSchemeId, data: Partial<MarkingSchemeModel>): Promise<MarkingSchemeModel>;
  remove(id: MarkingSchemeId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: MarkingSchemeId): Promise<MarkingSchemeModel> {
  return findByIdImpl<MarkingSchemeModel>(SPEC, { scheme_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<MarkingSchemeModel>): Promise<MarkingSchemeModel> {
  return insertRow<MarkingSchemeModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: MarkingSchemeId, data: Partial<MarkingSchemeModel>): Promise<MarkingSchemeModel> {
  return updateByIdImpl<MarkingSchemeModel>(SPEC, { scheme_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: MarkingSchemeId): Promise<void> {
  return deleteByIdImpl(SPEC, { scheme_id: id });
}

export const markingSchemeRepository: MarkingSchemeRepository = { findById, create, update, remove };
