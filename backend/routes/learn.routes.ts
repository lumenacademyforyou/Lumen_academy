import { Router } from "express";
import { makeOwnedCrudRouter } from "../lib/dbCrudRouter.js";
import { studyPlanRepository } from "../../db/learn/study_plan/study_plan.repository.js";
import { studySessionRepository } from "../../db/learn/study_plan/plan_task/study_session/study_session.repository.js";
import { topicMasteryRepository } from "../../db/learn/topic_mastery/topic_mastery.repository.js";
import { flashcardRepository } from "../../db/learn/flashcard/flashcard.repository.js";
import { errorLogRepository } from "../../db/learn/error_log/error_log.repository.js";
import { notificationRepository } from "../../db/learn/notification/notification.repository.js";

// learn entities with a direct user_id column and a single-uuid PK, scoped
// to the signed-in user via makeOwnedCrudRouter.
// Deliberately NOT wired in this pass — owned transitively via a parent row,
// same reasoning as assess.attempt_response etc.:
//   - plan_task          (via study_plan.user_id)
//   - flashcard_review   (via flashcard.user_id)
// Also not wired — actor_user_id is nullable (system-triggered actions have
// none) and this is meant to be an append-only audit trail, not a row a user
// edits or deletes through a CRUD endpoint:
//   - audit_log
const router = Router();

router.use("/study-plans", makeOwnedCrudRouter(studyPlanRepository, "user_id"));
router.use("/study-sessions", makeOwnedCrudRouter(studySessionRepository, "user_id"));
router.use("/topic-mastery", makeOwnedCrudRouter(topicMasteryRepository, "user_id"));
router.use("/flashcards", makeOwnedCrudRouter(flashcardRepository, "user_id"));
router.use("/error-log", makeOwnedCrudRouter(errorLogRepository, "user_id"));
router.use("/notifications", makeOwnedCrudRouter(notificationRepository, "user_id"));

export default router;
