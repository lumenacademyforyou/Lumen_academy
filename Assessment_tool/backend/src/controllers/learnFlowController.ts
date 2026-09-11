import { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import { listPlanTasks, updatePlanTaskStatus } from "../../../db/learn/study_plan/plan_task/plan-flow.js";
import { listFlashcardReviews, createFlashcardReview } from "../../../db/learn/flashcard/flashcard_review/review-flow.js";

// STAGE 4: mounted behind requirePlanOwnership(:planId) / requireDeckOwnership(:flashcardId),
// so ownership is already verified once per request before these run.

export async function getPlanTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await listPlanTasks(req.params.planId) });
  } catch (err) {
    next(err);
  }
}

export async function patchPlanTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const taskStatus = req.body?.task_status;
    if (typeof taskStatus !== "string" || taskStatus.length === 0) {
      next(new AppError(400, "VALIDATION_ERROR", "task_status is required."));
      return;
    }
    const task = await updatePlanTaskStatus(req.params.planId, req.params.taskId, taskStatus);
    res.json({ data: task });
  } catch (err) {
    next(err);
  }
}

export async function getFlashcardReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await listFlashcardReviews(req.params.flashcardId) });
  } catch (err) {
    next(err);
  }
}

export async function postFlashcardReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const review = await createFlashcardReview(req.params.flashcardId, req.body ?? {});
    res.status(201).json({ data: review });
  } catch (err) {
    next(err);
  }
}
