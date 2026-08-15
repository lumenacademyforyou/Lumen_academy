/**
 * Shared typed errors for the db/ repository and service layers.
 *
 * Every repository/service stub documents which of these it will throw once
 * implemented, via @throws tags that reference these classes directly —
 * not free-text comments — per the error cases required for every stub:
 * not found, duplicate key, FK violation, invalid state transition,
 * concurrent write.
 */

export class NotFoundError extends Error {
  constructor(entity: string, id: unknown) {
    super(`${entity} not found: ${JSON.stringify(id)}`);
    this.name = "NotFoundError";
  }
}

export class DuplicateKeyError extends Error {
  constructor(entity: string, key: string) {
    super(`${entity} violates a unique constraint: ${key}`);
    this.name = "DuplicateKeyError";
  }
}

export class ForeignKeyViolationError extends Error {
  constructor(entity: string, column: string) {
    super(`${entity}.${column} references a row that does not exist`);
    this.name = "ForeignKeyViolationError";
  }
}

export class InvalidStateTransitionError extends Error {
  constructor(entity: string, from: string, to: string) {
    super(`${entity} cannot transition from '${from}' to '${to}'`);
    this.name = "InvalidStateTransitionError";
  }
}

export class ConcurrentWriteError extends Error {
  constructor(entity: string, id: unknown) {
    super(`${entity} was modified concurrently: ${JSON.stringify(id)}`);
    this.name = "ConcurrentWriteError";
  }
}

export class NotImplementedError extends Error {
  constructor(member: string) {
    super(`not implemented: ${member}`);
    this.name = "NotImplementedError";
  }
}
