import type { AiGenerationJobModel } from "./ai_generation_job.model.js";
import type { AiGenerationJobId } from "./ai_generation_job.repository.js";
import { aiGenerationJobRepository } from "./ai_generation_job.repository.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../shared/errors.js";

/**
 * Thin pass-through to the repository. No business rules (state-machine
 * validation, optimistic-concurrency checks) are implemented here — the
 * design pack doesn't specify them for this entity, and no version/updated_at
 * column exists yet to detect a concurrent write. InvalidStateTransitionError
 * and ConcurrentWriteError stay declared in db/shared/errors.ts for whichever
 * layer implements those rules later; this service does not throw them.
 */
export interface AiGenerationJobService {
  get(id: AiGenerationJobId): Promise<AiGenerationJobModel>;
  create(data: Partial<AiGenerationJobModel>): Promise<AiGenerationJobModel>;
  update(id: AiGenerationJobId, data: Partial<AiGenerationJobModel>): Promise<AiGenerationJobModel>;
  remove(id: AiGenerationJobId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: AiGenerationJobId): Promise<AiGenerationJobModel> {
  return aiGenerationJobRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<AiGenerationJobModel>): Promise<AiGenerationJobModel> {
  return aiGenerationJobRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: AiGenerationJobId, data: Partial<AiGenerationJobModel>): Promise<AiGenerationJobModel> {
  return aiGenerationJobRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: AiGenerationJobId): Promise<void> {
  return aiGenerationJobRepository.remove(id);
}

export const aiGenerationJobService: AiGenerationJobService = { get, create, update, remove };
