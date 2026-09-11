import type { StudySessionModel } from "./study_session.model.js";
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

export type StudySessionId = string;

const SPEC: TableSpec = {
  schema: "learn",
  table: "study_session",
  entityLabel: "learn.study_session",
  pkColumns: ["session_id"],
};

export interface StudySessionRepository {
  findById(id: StudySessionId): Promise<StudySessionModel>;
  create(data: Partial<StudySessionModel>): Promise<StudySessionModel>;
  update(id: StudySessionId, data: Partial<StudySessionModel>): Promise<StudySessionModel>;
  remove(id: StudySessionId): Promise<void>;
}

/**
 * @throws {NotFoundError} id does not match any row
 */
async function findById(id: StudySessionId): Promise<StudySessionModel> {
  return findByIdImpl<StudySessionModel>(SPEC, { session_id: id });
}

/**
 * @throws {DuplicateKeyError} PK or AK already exists
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function create(data: Partial<StudySessionModel>): Promise<StudySessionModel> {
  return insertRow<StudySessionModel>(SPEC, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a referenced row does not exist
 */
async function update(id: StudySessionId, data: Partial<StudySessionModel>): Promise<StudySessionModel> {
  return updateByIdImpl<StudySessionModel>(SPEC, { session_id: id }, data as Record<string, unknown>);
}

/**
 * @throws {NotFoundError} id does not match any row
 * @throws {ForeignKeyViolationError} a dependent row still references this one
 */
async function remove(id: StudySessionId): Promise<void> {
  return deleteByIdImpl(SPEC, { session_id: id });
}

export const studySessionRepository: StudySessionRepository = { findById, create, update, remove };
