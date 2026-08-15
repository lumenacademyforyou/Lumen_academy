import type { NodeWeightageModel } from "./node_weightage.model.js";
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

export type NodeWeightageId = string;

const SPEC: TableSpec = {
  schema: "catalog",
  table: "node_weightage",
  entityLabel: "catalog.node_weightage",
  pkColumns: ["weightage_id"],
};

export interface NodeWeightageRepository {
  findById(id: NodeWeightageId): Promise<NodeWeightageModel>;
  create(data: Partial<NodeWeightageModel>): Promise<NodeWeightageModel>;
  update(id: NodeWeightageId, data: Partial<NodeWeightageModel>): Promise<NodeWeightageModel>;
  remove(id: NodeWeightageId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: NodeWeightageId): Promise<NodeWeightageModel> {
  return findByIdImpl<NodeWeightageModel>(SPEC, { weightage_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<NodeWeightageModel>): Promise<NodeWeightageModel> {
  return insertRow<NodeWeightageModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: NodeWeightageId, data: Partial<NodeWeightageModel>): Promise<NodeWeightageModel> {
  return updateByIdImpl<NodeWeightageModel>(SPEC, { weightage_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: NodeWeightageId): Promise<void> {
  return deleteByIdImpl(SPEC, { weightage_id: id });
}

export const nodeWeightageRepository: NodeWeightageRepository = { findById, create, update, remove };
