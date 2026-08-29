import { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  startAttempt as startAttemptFlow,
  upsertResponse,
  submitAttempt as submitAttemptFlow,
  listResponses,
  batchUpsertResponses,
  listEvents,
  appendEvent,
  getScorecardWithSections,
  getPaperForAttempt,
  pauseAttempt as pauseAttemptFlow,
  resumeAttempt as resumeAttemptFlow,
  getReview,
  listAttempts,
  type BatchResponseItem,
} from "../../../db/assess/test/attempt/attempt-flow.js";
import { getAttemptEnvelope } from "../../../db/assess/test/attempt/envelope.js";
import { getIrtReportForAttempt } from "../../../db/assess/analytics/irt.js";
import { getCohortComparison } from "../../../db/assess/analytics/dashboard.js";

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
    const idempotencyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined;
    const result = await startAttemptFlow(testId, req.user!.appUserId, idempotencyKey);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
}

export async function saveResponse(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Route param is questionId (brief's endpoint catalogue), not
    // testQuestionId — upsertResponse (TE-P4 rewrite) resolves the
    // FIXED-mode test_question_id internally when one exists.
    const body = req.body ?? {};
    const response = await upsertResponse(req.params.attemptId, req.params.questionId, req.user!.appUserId, {
      optionId: body.option_id ?? body.optionId ?? null,
      selectedOptionLabel: body.selected_option_label ?? body.selectedOptionLabel ?? null,
      numericAnswer: body.numeric_answer ?? body.numericAnswer ?? null,
      timeSpentSeconds: body.time_spent_seconds ?? body.timeSpentSeconds ?? null,
      isMarkedForReview: body.is_marked_for_review ?? body.isMarkedForReview ?? false,
    });
    res.json({ data: response });
  } catch (err) {
    next(err);
  }
}

export async function submitAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idempotencyKey = typeof req.body?.idempotencyKey === "string" ? req.body.idempotencyKey : undefined;
    const result = await submitAttemptFlow(req.params.attemptId, req.user!.appUserId, idempotencyKey);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

// --- STAGE 4: mounted behind requireAttemptOwnership(:attemptId), so
// ownership is already verified once per request before these run.

export async function getResponses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await listResponses(req.params.attemptId) });
  } catch (err) {
    next(err);
  }
}

export async function batchSaveResponses(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const items = req.body?.responses;
    if (!Array.isArray(items) || items.length === 0) {
      next(new AppError(400, "VALIDATION_ERROR", "responses must be a non-empty array."));
      return;
    }
    for (const item of items) {
      if (typeof item?.questionId !== "string" || item.questionId.length === 0) {
        next(new AppError(400, "VALIDATION_ERROR", "each response needs a questionId."));
        return;
      }
    }
    const saved = await batchUpsertResponses(req.params.attemptId, req.user!.appUserId, items as BatchResponseItem[]);
    res.json({ data: saved });
  } catch (err) {
    next(err);
  }
}

export async function getEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await listEvents(req.params.attemptId) });
  } catch (err) {
    next(err);
  }
}

export async function postEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const eventType = req.body?.event_type;
    if (typeof eventType !== "string" || eventType.length === 0) {
      next(new AppError(400, "VALIDATION_ERROR", "event_type is required."));
      return;
    }
    const event = await appendEvent(req.params.attemptId, eventType, req.body?.event_payload);
    res.status(201).json({ data: event });
  } catch (err) {
    next(err);
  }
}

export async function getPaper(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await getPaperForAttempt(req.params.attemptId) });
  } catch (err) {
    next(err);
  }
}

export async function getScorecard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { scorecard, sectionScores, timing } = await getScorecardWithSections(req.params.attemptId);
    if (!scorecard) {
      next(new AppError(404, "NOT_FOUND", "This attempt has not been scored yet."));
      return;
    }
    res.json({ data: { scorecard, sectionScores, timing } });
  } catch (err) {
    next(err);
  }
}

// --- TE-P4/TE-P5 additions, wired to HTTP for the first time here.

// Mode-agnostic replacement for getPaper (reads assess.attempt_question, not
// assess.test_question — getPaper only ever worked for FIXED-mode tests;
// every BLUEPRINT-mode test, including the new subject/chapter/topic/unit-
// wise practice tests, has nothing in test_question at all). Not replacing
// the getPaper route itself (still mounted, still used by whatever the
// frontend currently calls) — adding this alongside it, per TE-P4's own note
// that retiring the old route is TE-P6's job, not done here either.
export async function getEnvelope(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await getAttemptEnvelope(req.params.attemptId, req.user!.appUserId) });
  } catch (err) {
    next(err);
  }
}

export async function pauseAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await pauseAttemptFlow(req.params.attemptId, req.user!.appUserId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function resumeAttempt(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await resumeAttemptFlow(req.params.attemptId, req.user!.appUserId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getReviewHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await getReview(req.params.attemptId, req.user!.appUserId) });
  } catch (err) {
    next(err);
  }
}

// P1-7: real IRT ability estimate for one scored attempt (see
// db/assess/analytics/irt.ts). Same auth/ownership discipline as review —
// requireAttemptOwnership() below plus the function's own NotFoundError
// check.
export async function getIrtReportHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await getIrtReportForAttempt(req.user!.appUserId, req.params.attemptId) });
  } catch (err) {
    next(err);
  }
}

// P1-10: "comparison ... against the cohort average" — real ownership check
// via requireAttemptOwnership() on the route (same as every other
// :attemptId sub-route here); getCohortComparison itself only reads
// aggregate scorecard rows, never another student's individual attempt.
export async function getCohortComparisonHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await getCohortComparison(req.params.attemptId) });
  } catch (err) {
    next(err);
  }
}

export async function listOwnAttempts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const testId = typeof req.query.testId === "string" ? req.query.testId : undefined;
    res.json({ data: await listAttempts(req.user!.appUserId, testId) });
  } catch (err) {
    next(err);
  }
}
