import type { ScorecardModel } from "./scorecard.model.js";
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

export type ScorecardId = string;

const SPEC: TableSpec = {
  schema: "assess",
  table: "scorecard",
  entityLabel: "assess.scorecard",
  pkColumns: ["scorecard_id"],
};

export interface ScorecardRepository {
  findById(id: ScorecardId): Promise<ScorecardModel>;
  create(data: Partial<ScorecardModel>): Promise<ScorecardModel>;
  update(id: ScorecardId, data: Partial<ScorecardModel>): Promise<ScorecardModel>;
  remove(id: ScorecardId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: ScorecardId): Promise<ScorecardModel> {
  return findByIdImpl<ScorecardModel>(SPEC, { scorecard_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ScorecardModel>): Promise<ScorecardModel> {
  return insertRow<ScorecardModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ScorecardId, data: Partial<ScorecardModel>): Promise<ScorecardModel> {
  return updateByIdImpl<ScorecardModel>(SPEC, { scorecard_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: ScorecardId): Promise<void> {
  return deleteByIdImpl(SPEC, { scorecard_id: id });
}

export const scorecardRepository: ScorecardRepository = { findById, create, update, remove };
