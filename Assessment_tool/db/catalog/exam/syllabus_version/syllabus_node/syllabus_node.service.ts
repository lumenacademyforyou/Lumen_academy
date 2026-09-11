import type { SyllabusNodeModel } from "./syllabus_node.model.js";
import type { SyllabusNodeId } from "./syllabus_node.repository.js";
import { syllabusNodeRepository } from "./syllabus_node.repository.js";
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
export interface SyllabusNodeService {
  get(id: SyllabusNodeId): Promise<SyllabusNodeModel>;
  create(data: Partial<SyllabusNodeModel>): Promise<SyllabusNodeModel>;
  update(id: SyllabusNodeId, data: Partial<SyllabusNodeModel>): Promise<SyllabusNodeModel>;
  remove(id: SyllabusNodeId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function get(id: SyllabusNodeId): Promise<SyllabusNodeModel> {
  return syllabusNodeRepository.findById(id);
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<SyllabusNodeModel>): Promise<SyllabusNodeModel> {
  return syllabusNodeRepository.create(data);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: SyllabusNodeId, data: Partial<SyllabusNodeModel>): Promise<SyllabusNodeModel> {
  return syllabusNodeRepository.update(id, data);
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function remove(id: SyllabusNodeId): Promise<void> {
  return syllabusNodeRepository.remove(id);
}

export const syllabusNodeService: SyllabusNodeService = { get, create, update, remove };
