import type { StudyPlanModel } from "./study_plan.model.js";
import type { StudyPlanId } from "./study_plan.repository.js";
import { studyPlanRepository } from "./study_plan.repository.js";
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
export interface StudyPlanService {
  get(id: StudyPlanId): Promise<StudyPlanModel>;
  create(data: Partial<StudyPlanModel>): Promise<StudyPlanModel>;
  update(id: StudyPlanId, data: Partial<StudyPlanModel>): Promise<StudyPlanModel>;
  remove(id: StudyPlanId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: StudyPlanId): Promise<StudyPlanModel> {
  return studyPlanRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<StudyPlanModel>): Promise<StudyPlanModel> {
  return studyPlanRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: StudyPlanId, data: Partial<StudyPlanModel>): Promise<StudyPlanModel> {
  return studyPlanRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: StudyPlanId): Promise<void> {
  return studyPlanRepository.remove(id);
}

export const studyPlanService: StudyPlanService = { get, create, update, remove };
