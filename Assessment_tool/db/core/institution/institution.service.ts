import type { InstitutionModel } from "./institution.model.js";
import type { InstitutionId } from "./institution.repository.js";
import { institutionRepository } from "./institution.repository.js";
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
export interface InstitutionService {
  get(id: InstitutionId): Promise<InstitutionModel>;
  create(data: Partial<InstitutionModel>): Promise<InstitutionModel>;
  update(id: InstitutionId, data: Partial<InstitutionModel>): Promise<InstitutionModel>;
  remove(id: InstitutionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: InstitutionId): Promise<InstitutionModel> {
  return institutionRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<InstitutionModel>): Promise<InstitutionModel> {
  return institutionRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: InstitutionId, data: Partial<InstitutionModel>): Promise<InstitutionModel> {
  return institutionRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: InstitutionId): Promise<void> {
  return institutionRepository.remove(id);
}

export const institutionService: InstitutionService = { get, create, update, remove };
