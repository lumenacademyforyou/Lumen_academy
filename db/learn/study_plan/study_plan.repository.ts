import type { StudyPlanModel } from "./study_plan.model.js";
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

export type StudyPlanId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "study_plan",
  entityLabel: "learn.study_plan",
  pkColumns: ["plan_id"],
};

export interface StudyPlanRepository {
  findById(id: StudyPlanId): Promise<StudyPlanModel>;
  create(data: Partial<StudyPlanModel>): Promise<StudyPlanModel>;
  update(id: StudyPlanId, data: Partial<StudyPlanModel>): Promise<StudyPlanModel>;
  remove(id: StudyPlanId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: StudyPlanId): Promise<StudyPlanModel> {
  return findByIdImpl<StudyPlanModel>(SPEC, { plan_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<StudyPlanModel>): Promise<StudyPlanModel> {
  return insertRow<StudyPlanModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: StudyPlanId, data: Partial<StudyPlanModel>): Promise<StudyPlanModel> {
  return updateByIdImpl<StudyPlanModel>(SPEC, { plan_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: StudyPlanId): Promise<void> {
  return deleteByIdImpl(SPEC, { plan_id: id });
}

export const studyPlanRepository: StudyPlanRepository = { findById, create, update, remove };
