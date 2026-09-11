import type { ScorecardModel } from "./scorecard.model.js";
import type { ScorecardId } from "./scorecard.repository.js";
import { scorecardRepository } from "./scorecard.repository.js";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
} from "../../../../shared/errors.js";

/**
 * Thin pass-through to the repository. No business rules (state-machine
 * validation, optimistic-concurrency checks) are implemented here — the
 * design pack doesn't specify them for this entity, and no version/updated_at
 * column exists yet to detect a concurrent write. InvalidStateTransitionError
 * and ConcurrentWriteError stay declared in db/shared/errors.ts for whichever
 * layer implements those rules later; this service does not throw them.
 */
export interface ScorecardService {
  get(id: ScorecardId): Promise<ScorecardModel>;
  create(data: Partial<ScorecardModel>): Promise<ScorecardModel>;
  update(id: ScorecardId, data: Partial<ScorecardModel>): Promise<ScorecardModel>;
  remove(id: ScorecardId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: ScorecardId): Promise<ScorecardModel> {
  return scorecardRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<ScorecardModel>): Promise<ScorecardModel> {
  return scorecardRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: ScorecardId, data: Partial<ScorecardModel>): Promise<ScorecardModel> {
  return scorecardRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: ScorecardId): Promise<void> {
  return scorecardRepository.remove(id);
}

export const scorecardService: ScorecardService = { get, create, update, remove };
