import type { SubjectModel } from "./subject.model.js";
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

export type SubjectId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "subject",
  entityLabel: "catalog.subject",
  pkColumns: ["subject_id"],
};

export interface SubjectRepository {
  findById(id: SubjectId): Promise<SubjectModel>;
  create(data: Partial<SubjectModel>): Promise<SubjectModel>;
  update(id: SubjectId, data: Partial<SubjectModel>): Promise<SubjectModel>;
  remove(id: SubjectId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: SubjectId): Promise<SubjectModel> {
  return findByIdImpl<SubjectModel>(SPEC, { subject_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SubjectModel>): Promise<SubjectModel> {
  return insertRow<SubjectModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SubjectId, data: Partial<SubjectModel>): Promise<SubjectModel> {
  return updateByIdImpl<SubjectModel>(SPEC, { subject_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: SubjectId): Promise<void> {
  return deleteByIdImpl(SPEC, { subject_id: id });
}

export const subjectRepository: SubjectRepository = { findById, create, update, remove };
