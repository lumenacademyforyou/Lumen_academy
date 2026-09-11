import type { TopicMasteryModel } from "./topic_mastery.model.js";
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

export type TopicMasteryId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "topic_mastery",
  entityLabel: "learn.topic_mastery",
  pkColumns: ["mastery_id"],
};

export interface TopicMasteryRepository {
  findById(id: TopicMasteryId): Promise<TopicMasteryModel>;
  create(data: Partial<TopicMasteryModel>): Promise<TopicMasteryModel>;
  update(id: TopicMasteryId, data: Partial<TopicMasteryModel>): Promise<TopicMasteryModel>;
  remove(id: TopicMasteryId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: TopicMasteryId): Promise<TopicMasteryModel> {
  return findByIdImpl<TopicMasteryModel>(SPEC, { mastery_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<TopicMasteryModel>): Promise<TopicMasteryModel> {
  return insertRow<TopicMasteryModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: TopicMasteryId, data: Partial<TopicMasteryModel>): Promise<TopicMasteryModel> {
  return updateByIdImpl<TopicMasteryModel>(SPEC, { mastery_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: TopicMasteryId): Promise<void> {
  return deleteByIdImpl(SPEC, { mastery_id: id });
}

export const topicMasteryRepository: TopicMasteryRepository = { findById, create, update, remove };
