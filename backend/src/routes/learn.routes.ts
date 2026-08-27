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
import { getPlanTasks, patchPlanTaskStatus, getFlashcardReviews, postFlashcardReview } from "../controllers/learnFlowController.js";

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

const studyPlansRouter = makeOwnedCrudRouter(studyPlanRepository, "user_id");
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
router.use("/notifications", notificationsListRouter);
router.use("/notifications", makeOwnedCrudRouter(notificationRepository, "user_id"));

export default router;
