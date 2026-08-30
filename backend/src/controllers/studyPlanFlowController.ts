import { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";
import {
  findActivePlan,
  getOrCreateActivePlan,
  updatePlanConfig,
  resetPlan,
  listGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  reorderGoals,
} from "../../../db/learn/study_plan/study-plan-flow.js";

// BUG-19 (docs/assessment-tool-debug-plan.md Phase 7) — "create once, edit
// anytime." Mounted ahead of the generic makeOwnedCrudRouter for
// /study-plans (learn.routes.ts), same reasoning as notificationsListRouter
// there: these are fixed sub-paths ("me", "reset"), not ids, so they must be
// registered before the generic router's own GET/PATCH/DELETE /:id would
// otherwise try to match them as a planId.

function parseExamYear(config: unknown): number {
  const raw = (config as { targetExamYear?: string } | undefined)?.targetExamYear;
  const match = typeof raw === "string" ? raw.match(/\d{4}/) : null;
  return match ? Number(match[0]) : new Date().getFullYear();
}

export async function getMyActivePlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const plan = await findActivePlan(req.user!.appUserId);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function saveMyPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = (req.body?.config ?? {}) as Record<string, unknown>;
    const examYear = parseExamYear(config);
    const existing = await findActivePlan(req.user!.appUserId);
    const plan = existing
      ? await updatePlanConfig(existing.plan_id, config)
      : await getOrCreateActivePlan(req.user!.appUserId, examYear, config);
    res.json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function resetMyPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const config = (req.body?.config ?? {}) as Record<string, unknown>;
    const examYear = parseExamYear(config);
    const plan = await resetPlan(req.user!.appUserId, examYear, config);
    res.status(201).json({ data: plan });
  } catch (err) {
    next(err);
  }
}

export async function getMyPlanGoals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({ data: await listGoals(req.params.planId) });
  } catch (err) {
    next(err);
  }
}

export async function postMyPlanGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { subject, chapter, high_yield_tag, hours_needed } = req.body ?? {};
    if (typeof subject !== "string" || !subject.trim() || typeof chapter !== "string" || !chapter.trim()) {
      next(new AppError(400, "VALIDATION_ERROR", "subject and chapter are required."));
      return;
    }
    const goal = await createGoal(req.params.planId, { subject, chapter, high_yield_tag, hours_needed });
    res.status(201).json({ data: goal });
  } catch (err) {
    next(err);
  }
}

export async function patchMyPlanGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const goal = await updateGoal(req.params.planId, req.params.goalId, req.body ?? {});
    res.json({ data: goal });
  } catch (err) {
    next(err);
  }
}

export async function deleteMyPlanGoal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteGoal(req.params.planId, req.params.goalId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function putMyPlanGoalOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const orderedGoalIds = req.body?.goalIds;
    if (!Array.isArray(orderedGoalIds) || orderedGoalIds.some((id) => typeof id !== "string")) {
      next(new AppError(400, "VALIDATION_ERROR", "goalIds must be an array of strings."));
      return;
    }
    const goals = await reorderGoals(req.params.planId, orderedGoalIds);
    res.json({ data: goals });
  } catch (err) {
    next(err);
  }
}
