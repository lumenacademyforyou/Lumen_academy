import type { NextFunction, Request, Response } from "express";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
  InvalidStateTransitionError,
  ConcurrentWriteError,
  PoolInsufficientError,
  PaperInvalidError,
  TestNotPublishedError,
  TestWindowClosedError,
  IdempotencyConflictError,
  QuestionNotInAttemptError,
  InvalidNumericAnswerError,
  ScoringRuleMissingError,
} from "../../db/shared/errors.js";

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Maps db/ repository errors to HTTP status codes so controllers built on
// db/ repositories don't each need their own try/catch translation.
const DB_ERROR_STATUS: [new (...args: never[]) => Error, { status: number; code: string }][] = [
  [NotFoundError, { status: 404, code: "NOT_FOUND" }],
  [DuplicateKeyError, { status: 409, code: "DUPLICATE_KEY" }],
  [ForeignKeyViolationError, { status: 409, code: "FK_VIOLATION" }],
  // Generic — thrown by both assess.attempt transitions and content.question
  // lifecycle transitions (CL-4); not attempt-specific despite the class's
  // original name.
  [InvalidStateTransitionError, { status: 409, code: "INVALID_STATE_TRANSITION" }],
  [ConcurrentWriteError, { status: 409, code: "CONCURRENT_WRITE" }],
  [TestNotPublishedError, { status: 409, code: "TEST_NOT_PUBLISHED" }],
  [TestWindowClosedError, { status: 409, code: "TEST_WINDOW_CLOSED" }],
  [IdempotencyConflictError, { status: 409, code: "IDEMPOTENCY_CONFLICT" }],
  [QuestionNotInAttemptError, { status: 422, code: "QUESTION_NOT_IN_ATTEMPT" }],
  [InvalidNumericAnswerError, { status: 422, code: "INVALID_NUMERIC_ANSWER" }],
];

// Postgres SQLSTATE codes for malformed/missing request input that never
// reached one of the typed db/ errors above (e.g. a NOT NULL column omitted
// from the request body, or a malformed uuid). Mapped to 400 instead of
// falling through to the generic 500 below.
const PG_CLIENT_ERROR_CODES = new Set(["23502", "22P02", "22007", "22008"]);

// TE-P0 (docs/ENGINE_STATE.md §3) confirmed two live scoring-integrity
// defenses were degrading to a generic 500 instead of a catalogued 4xx:
// assess.trg_attempt_response_option_guard's RAISE EXCEPTION, and the
// uq_attempt_test_id_user_id_attempt_no unique-violation race. LM001 is the
// guard trigger's own custom SQLSTATE (db/migrations/020_attempt_question.sql)
// — mapped to the brief's catalogued RESPONSE_OPTION_MISMATCH. 23505 is
// Postgres's standard unique_violation, mapped generically since this
// handler has no way to know which constraint fired.
const PG_ERROR_CODE_MAP: Record<string, { status: number; code: string }> = {
  LM001: { status: 422, code: "RESPONSE_OPTION_MISMATCH" },
  "23505": { status: 409, code: "DUPLICATE_KEY" },
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  if (err instanceof PoolInsufficientError) {
    res.status(422).json({
      error: {
        code: "POOL_INSUFFICIENT",
        message: err.message,
        blueprintId: err.blueprintId,
        testSectionId: err.testSectionId,
        requested: err.requested,
        available: err.available,
      },
    });
    return;
  }
  if (err instanceof PaperInvalidError) {
    res.status(422).json({ error: { code: "PAPER_INVALID", message: err.message, itemErrors: err.itemErrors } });
    return;
  }
  if (err instanceof ScoringRuleMissingError) {
    // Section 9: "a data defect, logged loudly" — not a client-caused error.
    console.error("SCORING_RULE_MISSING:", err.message);
    res.status(500).json({ error: { code: "SCORING_RULE_MISSING", message: err.message } });
    return;
  }

  for (const [ErrorClass, mapped] of DB_ERROR_STATUS) {
    if (err instanceof ErrorClass) {
      res.status(mapped.status).json({ error: { code: mapped.code, message: err.message } });
      return;
    }
  }

  const pgErr = err as { code?: string; message?: string };
  if (pgErr?.code && pgErr.code in PG_ERROR_CODE_MAP) {
    const mapped = PG_ERROR_CODE_MAP[pgErr.code];
    res.status(mapped.status).json({ error: { code: mapped.code, message: pgErr.message ?? "Request rejected." } });
    return;
  }
  if (pgErr?.code && PG_CLIENT_ERROR_CODES.has(pgErr.code)) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: pgErr.message ?? "Invalid request." } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
}
