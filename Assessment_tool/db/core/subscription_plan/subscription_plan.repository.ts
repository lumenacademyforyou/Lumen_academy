import type { SubscriptionPlanModel } from "./subscription_plan.model.js";
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

export type SubscriptionPlanId = string;

const SPEC: TableSpec = {
  schema: "core",
  table: "subscription_plan",
  entityLabel: "core.subscription_plan",
  pkColumns: ["plan_id"],
};

export interface SubscriptionPlanRepository {
  findById(id: SubscriptionPlanId): Promise<SubscriptionPlanModel>;
  create(data: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel>;
  update(id: SubscriptionPlanId, data: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel>;
  remove(id: SubscriptionPlanId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: SubscriptionPlanId): Promise<SubscriptionPlanModel> {
  return findByIdImpl<SubscriptionPlanModel>(SPEC, { plan_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel> {
  return insertRow<SubscriptionPlanModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SubscriptionPlanId, data: Partial<SubscriptionPlanModel>): Promise<SubscriptionPlanModel> {
  return updateByIdImpl<SubscriptionPlanModel>(SPEC, { plan_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: SubscriptionPlanId): Promise<void> {
  return deleteByIdImpl(SPEC, { plan_id: id });
}

export const subscriptionPlanRepository: SubscriptionPlanRepository = { findById, create, update, remove };
