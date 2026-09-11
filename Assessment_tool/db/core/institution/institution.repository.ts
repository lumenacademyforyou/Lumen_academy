import type { InstitutionModel } from "./institution.model.js";
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

export type InstitutionId = string;

const SPEC: TableSpec = {
  schema: "core",
  table: "institution",
  entityLabel: "core.institution",
  pkColumns: ["institution_id"],
};

export interface InstitutionRepository {
  findById(id: InstitutionId): Promise<InstitutionModel>;
  create(data: Partial<InstitutionModel>): Promise<InstitutionModel>;
  update(id: InstitutionId, data: Partial<InstitutionModel>): Promise<InstitutionModel>;
  remove(id: InstitutionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: InstitutionId): Promise<InstitutionModel> {
  return findByIdImpl<InstitutionModel>(SPEC, { institution_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<InstitutionModel>): Promise<InstitutionModel> {
  return insertRow<InstitutionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: InstitutionId, data: Partial<InstitutionModel>): Promise<InstitutionModel> {
  return updateByIdImpl<InstitutionModel>(SPEC, { institution_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: InstitutionId): Promise<void> {
  return deleteByIdImpl(SPEC, { institution_id: id });
}

export const institutionRepository: InstitutionRepository = { findById, create, update, remove };
