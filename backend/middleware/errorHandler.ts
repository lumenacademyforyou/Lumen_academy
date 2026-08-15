import type { NextFunction, Request, Response } from "express";
import {
  NotFoundError,
  DuplicateKeyError,
  ForeignKeyViolationError,
  InvalidStateTransitionError,
  ConcurrentWriteError,
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
  [InvalidStateTransitionError, { status: 409, code: "INVALID_STATE_TRANSITION" }],
  [ConcurrentWriteError, { status: 409, code: "CONCURRENT_WRITE" }],
];

// Postgres SQLSTATE codes for malformed/missing request input that never
// reached one of the typed db/ errors above (e.g. a NOT NULL column omitted
// from the request body, or a malformed uuid). Mapped to 400 instead of
// falling through to the generic 500 below.
const PG_CLIENT_ERROR_CODES = new Set(["23502", "22P02", "22007", "22008"]);

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  for (const [ErrorClass, mapped] of DB_ERROR_STATUS) {
    if (err instanceof ErrorClass) {
      res.status(mapped.status).json({ error: { code: mapped.code, message: err.message } });
      return;
    }
  }

  const pgErr = err as { code?: string; message?: string };
  if (pgErr?.code && PG_CLIENT_ERROR_CODES.has(pgErr.code)) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: pgErr.message ?? "Invalid request." } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
}
