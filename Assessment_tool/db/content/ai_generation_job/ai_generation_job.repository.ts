import type { AiGenerationJobModel } from "./ai_generation_job.model.js";
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

export type AiGenerationJobId = string;

const SPEC: TableSpec = {
  schema: "content",
  table: "ai_generation_job",
  entityLabel: "content.ai_generation_job",
  pkColumns: ["job_id"],
};

export interface AiGenerationJobRepository {
  findById(id: AiGenerationJobId): Promise<AiGenerationJobModel>;
  create(data: Partial<AiGenerationJobModel>): Promise<AiGenerationJobModel>;
  update(id: AiGenerationJobId, data: Partial<AiGenerationJobModel>): Promise<AiGenerationJobModel>;
  remove(id: AiGenerationJobId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: AiGenerationJobId): Promise<AiGenerationJobModel> {
  return findByIdImpl<AiGenerationJobModel>(SPEC, { job_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AiGenerationJobModel>): Promise<AiGenerationJobModel> {
  return insertRow<AiGenerationJobModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AiGenerationJobId, data: Partial<AiGenerationJobModel>): Promise<AiGenerationJobModel> {
  return updateByIdImpl<AiGenerationJobModel>(SPEC, { job_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: AiGenerationJobId): Promise<void> {
  return deleteByIdImpl(SPEC, { job_id: id });
}

export const aiGenerationJobRepository: AiGenerationJobRepository = { findById, create, update, remove };
