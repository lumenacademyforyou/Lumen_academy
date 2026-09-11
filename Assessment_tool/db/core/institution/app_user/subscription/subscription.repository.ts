import type { SubscriptionModel } from "./subscription.model.js";
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

export type SubscriptionId = string;

const SPEC: TableSpec = {
  schema: "core",
  table: "subscription",
  entityLabel: "core.subscription",
  pkColumns: ["subscription_id"],
};

export interface SubscriptionRepository {
  findById(id: SubscriptionId): Promise<SubscriptionModel>;
  create(data: Partial<SubscriptionModel>): Promise<SubscriptionModel>;
  update(id: SubscriptionId, data: Partial<SubscriptionModel>): Promise<SubscriptionModel>;
  remove(id: SubscriptionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: SubscriptionId): Promise<SubscriptionModel> {
  return findByIdImpl<SubscriptionModel>(SPEC, { subscription_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SubscriptionModel>): Promise<SubscriptionModel> {
  return insertRow<SubscriptionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SubscriptionId, data: Partial<SubscriptionModel>): Promise<SubscriptionModel> {
  return updateByIdImpl<SubscriptionModel>(SPEC, { subscription_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: SubscriptionId): Promise<void> {
  return deleteByIdImpl(SPEC, { subscription_id: id });
}

export const subscriptionRepository: SubscriptionRepository = { findById, create, update, remove };
