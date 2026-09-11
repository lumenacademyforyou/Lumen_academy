import { Router, Request, Response, NextFunction } from "express";
import { makeOwnedCrudRouter } from "../lib/dbCrudRouter.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePlanOwnership, requireDeckOwnership } from "../middleware/ownership.js";
import { studyPlanRepository } from "../../../db/learn/study_plan/study_plan.repository.js";
import { studySessionRepository } from "../../../db/learn/study_plan/plan_task/study_session/study_session.repository.js";
import { topicMasteryRepository } from "../../../db/learn/topic_mastery/topic_mastery.repository.js";
import { flashcardRepository } from "../../../db/learn/flashcard/flashcard.repository.js";
import { errorLogRepository } from "../../../db/learn/error_log/error_log.repository.js";
import { notificationRepository } from "../../../db/learn/notification/notification.repository.js";
import { customTaskRepository } from "../../../db/learn/custom_task/custom_task.repository.js";
import { revisionNoteRepository } from "../../../db/learn/revision_note/revision_note.repository.js";
import { pomodoroSessionRepository } from "../../../db/learn/pomodoro_session/pomodoro_session.repository.js";
import { getPlanTasks, patchPlanTaskStatus, getFlashcardReviews, postFlashcardReview } from "../controllers/learnFlowController.js";
import { listUnitMaterials, listUnitMaterialsByTagCodes, downloadUnitMaterial } from "../controllers/unitMaterialController.js";
import {
  getMyActivePlan,
  saveMyPlan,
  resetMyPlan,
  getMyPlanGoals,
  postMyPlanGoal,
  patchMyPlanGoal,
  deleteMyPlanGoal,
  putMyPlanGoalOrder,
} from "../controllers/studyPlanFlowController.js";

// learn entities with a direct user_id column and a single-uuid PK, scoped
// to the signed-in user via makeOwnedCrudRouter.
//
// STAGE 4: plan_task (owned via study_plan.user_id) and flashcard_review
// (owned via flashcard.user_id) have no direct user_id column. Solved via
// requirePlanOwnership / requireDeckOwnership (backend/middleware/ownership.ts),
// resolved ONCE per request from the route param, not re-checked per task/review.
//
// Still NOT wired — actor_user_id is nullable (system-triggered actions have
// none) and this is meant to be an append-only audit trail, not a row a user
// edits or deletes through a CRUD endpoint:
//   - audit_log
const router = Router();

// BUG-19 — "create once, edit anytime" fixed sub-paths ("me", "reset") must
// be registered on their own router mounted BEFORE the generic
// makeOwnedCrudRouter below, same reasoning as notificationsListRouter
// further down: that router's own GET/PATCH/DELETE /:id would otherwise
// swallow "me"/"reset" as if they were a literal planId.
const studyPlanFlowRouter = Router();
studyPlanFlowRouter.use(requireAuth);
studyPlanFlowRouter.get("/me", getMyActivePlan);
studyPlanFlowRouter.post("/me", saveMyPlan);
studyPlanFlowRouter.post("/reset", resetMyPlan);
router.use("/study-plans", studyPlanFlowRouter);

const studyPlansRouter = makeOwnedCrudRouter(studyPlanRepository, "user_id");
studyPlansRouter.get("/:planId/goals", requirePlanOwnership(), getMyPlanGoals);
studyPlansRouter.post("/:planId/goals", requirePlanOwnership(), postMyPlanGoal);
studyPlansRouter.put("/:planId/goals/order", requirePlanOwnership(), putMyPlanGoalOrder);
studyPlansRouter.patch("/:planId/goals/:goalId", requirePlanOwnership(), patchMyPlanGoal);
studyPlansRouter.delete("/:planId/goals/:goalId", requirePlanOwnership(), deleteMyPlanGoal);
studyPlansRouter.get("/:planId/tasks", requirePlanOwnership(), getPlanTasks);
studyPlansRouter.patch("/:planId/tasks/:taskId", requirePlanOwnership(), patchPlanTaskStatus);
router.use("/study-plans", studyPlansRouter);

router.use("/study-sessions", makeOwnedCrudRouter(studySessionRepository, "user_id"));
router.use("/topic-mastery", makeOwnedCrudRouter(topicMasteryRepository, "user_id"));

const flashcardsRouter = makeOwnedCrudRouter(flashcardRepository, "user_id");
flashcardsRouter.get("/:flashcardId/reviews", requireDeckOwnership(), getFlashcardReviews);
flashcardsRouter.post("/:flashcardId/reviews", requireDeckOwnership(), postFlashcardReview);
router.use("/flashcards", flashcardsRouter);

router.use("/error-log", makeOwnedCrudRouter(errorLogRepository, "user_id"));

// makeOwnedCrudRouter only ever exposes GET /:id (fetch one, by an id the
// caller must already know) — no entity mounted through it has needed "list
// mine" until now. Mounted as its own router, ahead of the generic one, on
// the same "/notifications" prefix: a route not matched here falls through
// to the next router.use() at the same prefix, but if these were instead
// added directly onto makeOwnedCrudRouter's own router object, PATCH
// /read-all would be shadowed by that router's own already-registered
// PATCH /:id (matching "read-all" as if it were an id) — found by tracing
// through Express's route-match-by-registration-order behavior before
// shipping this, not by hitting it live.
const notificationsListRouter = Router();
notificationsListRouter.use(requireAuth);
notificationsListRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await notificationRepository.findByUser(req.user!.appUserId) });
  } catch (err) {
    next(err);
  }
});
notificationsListRouter.patch("/read-all", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationRepository.markAllRead(req.user!.appUserId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
// P0-5: "Clear all" — a bare DELETE / (no id), same reason it's registered
// here rather than on the generic makeOwnedCrudRouter below: that router
// only ever defines DELETE /:id, so this doesn't shadow anything, but it
// must still come first for consistency with read-all above.
notificationsListRouter.delete("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    await notificationRepository.clearAll(req.user!.appUserId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
router.use("/notifications", notificationsListRouter);
router.use("/notifications", makeOwnedCrudRouter(notificationRepository, "user_id"));

// BUG-20/21/22 (docs/assessment-tool-debug-plan.md Phase 7) — real
// persistence for what StudyPlanView.tsx's "My Custom Study Tasks" /
// "My Personal Revision Notes" panels and PomodoroTimer.tsx's session log
// previously pointed at nonexistent Supabase tables / localStorage. Same
// "list mine" pattern as notificationsListRouter above (makeOwnedCrudRouter
// has no list-all-mine route), mounted ahead of the generic router each time.
const customTasksListRouter = Router();
customTasksListRouter.use(requireAuth);
customTasksListRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await customTaskRepository.findByUser(req.user!.appUserId) });
  } catch (err) {
    next(err);
  }
});
router.use("/custom-tasks", customTasksListRouter);
router.use("/custom-tasks", makeOwnedCrudRouter(customTaskRepository, "user_id"));

const revisionNotesListRouter = Router();
revisionNotesListRouter.use(requireAuth);
revisionNotesListRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ data: await revisionNoteRepository.findByUser(req.user!.appUserId) });
  } catch (err) {
    next(err);
  }
});
router.use("/revision-notes", revisionNotesListRouter);
router.use("/revision-notes", makeOwnedCrudRouter(revisionNoteRepository, "user_id"));

// BUG-22 — the visible log defaults to the plan's own "last 20 sessions",
// but a study-streak calculation (Header.tsx/DashboardView.tsx) needs a
// wider window than that to count consecutive days correctly, so an
// optional ?limit= is honored here (capped at 200 so a crafted query can't
// force an unbounded scan).
const pomodoroSessionsListRouter = Router();
pomodoroSessionsListRouter.use(requireAuth);
pomodoroSessionsListRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requested = Number(req.query.limit);
    const limit = Number.isFinite(requested) && requested > 0 ? Math.min(requested, 200) : 20;
    res.json({ data: await pomodoroSessionRepository.findRecentByUser(req.user!.appUserId, limit) });
  } catch (err) {
    next(err);
  }
});
router.use("/pomodoro-sessions", pomodoroSessionsListRouter);
router.use("/pomodoro-sessions", makeOwnedCrudRouter(pomodoroSessionRepository, "user_id"));

// Task 4 (docs/neet-tool-fix-prompt.md) — read-only, platform-owned course
// materials (not user-owned, so no makeOwnedCrudRouter here). Registered as
// its own router, same reasoning as notificationsListRouter above: the
// query-param list route must come before the :unitId param route so
// "by-tag-codes" is never swallowed as a literal unitId.
const unitMaterialsRouter = Router();
unitMaterialsRouter.use(requireAuth);
unitMaterialsRouter.get("/by-tag-codes", listUnitMaterialsByTagCodes);
unitMaterialsRouter.get("/unit/:unitId", listUnitMaterials);
unitMaterialsRouter.get("/:materialId/download", downloadUnitMaterial);
router.use("/unit-materials", unitMaterialsRouter);

export default router;
