import { NextFunction, Request, RequestHandler, Response } from "express";
import { pool } from "../../db/shared/pool.js";
import { AppError } from "./errorHandler.js";

// Reusable ownership guards for entities whose owner link is transitive
// (child -> parent -> owning user_id), which backend/lib/dbCrudRouter.ts's
// makeOwnedCrudRouter can't handle (it only checks a direct owner column).
// Each resolver is ONE indexed query joining child -> parent -> user.
//
// 404, not 403, for a row that exists but isn't yours — same reasoning as
// makeOwnedCrudRouter: an id can't be distinguished from "doesn't exist" by
// response code, so ownership can't be probed by enumeration.
//
// Resolve ownership ONCE per request, at the parent (route param) level, via
// the requireXOwnership() middleware below — not per child row inside a
// batch operation.

const NOT_FOUND = () => new AppError(404, "NOT_FOUND", "Resource not found.");

export async function assertAttemptOwnership(userId: string, attemptId: string): Promise<void> {
  const res = await pool.query("select 1 from assess.attempt where attempt_id = $1 and user_id = $2", [attemptId, userId]);
  if (res.rowCount === 0) throw NOT_FOUND();
}

export async function assertPlanOwnership(userId: string, planId: string): Promise<void> {
  const res = await pool.query("select 1 from learn.study_plan where plan_id = $1 and user_id = $2", [planId, userId]);
  if (res.rowCount === 0) throw NOT_FOUND();
}

export async function assertDeckOwnership(userId: string, flashcardId: string): Promise<void> {
  const res = await pool.query("select 1 from learn.flashcard where flashcard_id = $1 and user_id = $2", [flashcardId, userId]);
  if (res.rowCount === 0) throw NOT_FOUND();
}

function requireOwnership(
  paramName: string,
  assert: (userId: string, id: string) => Promise<void>
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await assert(req.user!.appUserId, req.params[paramName]);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireAttemptOwnership = (paramName = "attemptId"): RequestHandler =>
  requireOwnership(paramName, assertAttemptOwnership);

export const requirePlanOwnership = (paramName = "planId"): RequestHandler =>
  requireOwnership(paramName, assertPlanOwnership);

export const requireDeckOwnership = (paramName = "flashcardId"): RequestHandler =>
  requireOwnership(paramName, assertDeckOwnership);
