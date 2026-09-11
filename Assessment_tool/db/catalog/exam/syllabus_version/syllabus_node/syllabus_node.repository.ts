import type { SyllabusNodeModel } from "./syllabus_node.model.js";
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

export type SyllabusNodeId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "syllabus_node",
  entityLabel: "catalog.syllabus_node",
  pkColumns: ["node_id"],
};

export interface SyllabusNodeRepository {
  findById(id: SyllabusNodeId): Promise<SyllabusNodeModel>;
  create(data: Partial<SyllabusNodeModel>): Promise<SyllabusNodeModel>;
  update(id: SyllabusNodeId, data: Partial<SyllabusNodeModel>): Promise<SyllabusNodeModel>;
  remove(id: SyllabusNodeId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: SyllabusNodeId): Promise<SyllabusNodeModel> {
  return findByIdImpl<SyllabusNodeModel>(SPEC, { node_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SyllabusNodeModel>): Promise<SyllabusNodeModel> {
  return insertRow<SyllabusNodeModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SyllabusNodeId, data: Partial<SyllabusNodeModel>): Promise<SyllabusNodeModel> {
  return updateByIdImpl<SyllabusNodeModel>(SPEC, { node_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: SyllabusNodeId): Promise<void> {
  return deleteByIdImpl(SPEC, { node_id: id });
}

export const syllabusNodeRepository: SyllabusNodeRepository = { findById, create, update, remove };
