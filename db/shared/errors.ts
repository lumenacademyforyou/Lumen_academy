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

/** TE-P3 assembleForAttempt: a BLUEPRINT line could not be filled from the live candidate pool. */
export class PoolInsufficientError extends Error {
  constructor(
    public readonly blueprintId: string,
    public readonly testSectionId: string,
    public readonly requested: number,
    public readonly available: number
  ) {
    super(
      `blueprint ${blueprintId} (test_section ${testSectionId}) requested ${requested} questions but only ${available} are available in the candidate pool`
    );
    this.name = "PoolInsufficientError";
  }
}

/** TE-P3 ingestFixedPaper: one or more questions in the payload failed validation. Rejects the whole payload. */
export class PaperInvalidError extends Error {
  constructor(public readonly itemErrors: { testSectionId: string; questionId: string; reason: string }[]) {
    super(`fixed-paper ingestion rejected: ${itemErrors.length} invalid item(s)`);
    this.name = "PaperInvalidError";
  }
}

/** TE-P4 startAttempt: the test exists but isn't published. */
export class TestNotPublishedError extends Error {
  constructor(testId: string, status: string) {
    super(`test ${testId} is not published (status: ${status})`);
    this.name = "TestNotPublishedError";
  }
}

/** TE-P4 startAttempt: outside the test's availability window. */
export class TestWindowClosedError extends Error {
  constructor(testId: string) {
    super(`test ${testId} is outside its availability window`);
    this.name = "TestWindowClosedError";
  }
}

/** TE-P4/8.2: an idempotency key was reused with a different payload than its first use. */
export class IdempotencyConflictError extends Error {
  constructor(key: string) {
    super(`idempotency key ${key} was already used with a different request`);
    this.name = "IdempotencyConflictError";
  }
}

/** TE-P4 upsertResponse/submitAttempt: the question was never served in this attempt. */
export class QuestionNotInAttemptError extends Error {
  constructor(attemptId: string, questionId: string) {
    super(`question ${questionId} was not served in attempt ${attemptId}`);
    this.name = "QuestionNotInAttemptError";
  }
}

/** TE-P4 upsertResponse: a numeric response value doesn't parse as NUMERIC. */
export class InvalidNumericAnswerError extends Error {
  constructor(value: unknown) {
    super(`"${value}" does not parse as a NUMERIC value`);
    this.name = "InvalidNumericAnswerError";
  }
}

/** TE-P4 submitAttempt: no scoring rule resolves for a served question — a data defect. */
export class ScoringRuleMissingError extends Error {
  constructor(questionId: string, testSectionId: string) {
    super(`no scoring rule resolves for question ${questionId} in test_section ${testSectionId}`);
    this.name = "ScoringRuleMissingError";
  }
}

/** TE-P4: the attempt has passed its effective deadline; middleware should force-submit instead. */
export class AttemptExpiredError extends Error {
  constructor(attemptId: string) {
    super(`attempt ${attemptId} has passed its deadline`);
    this.name = "AttemptExpiredError";
  }
}
