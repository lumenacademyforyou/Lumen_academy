import { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  startAttempt as startAttemptFlow,
  upsertResponse,
  submitAttempt as submitAttemptFlow,
} from "../../db/assess/test/attempt/attempt-flow.js";

// Real (non-mock) attempt lifecycle, backed by db/assess/test/attempt/attempt-flow.ts.
// Separate from the legacy mock attemptController.submitAttempt (still mounted
// at POST /api/submit-attempt) rather than replacing it in place — that
// endpoint's response shape may already be depended on by the frontend, and
// swapping it silently risks breaking the currently-working UI. These are new
// routes under /api/assess/attempts/*.

export async function startAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = req.body?.test_id;
    if (typeof testId !== "string" || testId.length === 0) {
      next(new AppError(400, "VALIDATION_ERROR", "test_id is required."));
      return;
    }
    const attempt = await startAttemptFlow(testId, req.user!.id);
    res.status(201).json({ data: attempt });
  } catch (err) {
    next(err);
  }
}

export async function saveResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const response = await upsertResponse(req.params.attemptId, req.params.testQuestionId, req.user!.id, req.body ?? {});
    res.json({ data: response });
  } catch (err) {
    next(err);
  }
}

export async function submitAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { attempt, scorecard } = await submitAttemptFlow(req.params.attemptId, req.user!.id);
    res.json({ data: { attempt, scorecard } });
  } catch (err) {
    next(err);
  }
}
