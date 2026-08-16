import { Router } from "express";
import { makeOwnedCrudRouter } from "../lib/dbCrudRouter.js";
import { requireAttemptOwnership } from "../middleware/ownership.js";
import { attemptRepository } from "../../db/assess/test/attempt/attempt.repository.js";
import {
  startAttempt,
  saveResponse,
  submitAttempt,
  getResponses,
  batchSaveResponses,
  getEvents,
  postEvent,
  getScorecard,
  getPaper,
} from "../controllers/attemptFlowController.js";

// assess.attempt has a direct user_id column, so makeOwnedCrudRouter's
// per-row ownership check applies directly. This is the exact case
// docs/design/LA-DBD-004_backend_schema_map.md calls out: "A student may
// never read another student's attempt."
//
// STAGE 4: attempt_response / attempt_event / scorecard / section_score have
// no direct user_id column — ownership is transitive via attempt.user_id.
// Solved here via requireAttemptOwnership (backend/middleware/ownership.ts):
// resolved ONCE per request from :attemptId, not re-checked per child row.
// section_score is exposed nested inside the scorecard response, not as its
// own route (it only ever makes sense in the context of a scorecard).
//
// Still NOT wired — not user-owned at all, tenant/admin-scoped:
//   - test, test_section, test_question, test_assignment
const router = Router();

const attemptsRouter = makeOwnedCrudRouter(attemptRepository, "user_id");
// Real attempt lifecycle (see backend/controllers/attemptFlowController.ts):
// these inherit the requireAuth that makeOwnedCrudRouter already applied above.
attemptsRouter.post("/start", startAttempt);
attemptsRouter.patch("/:attemptId/responses/:testQuestionId", saveResponse);
attemptsRouter.post("/:attemptId/submit", submitAttempt);
attemptsRouter.get("/:attemptId/paper", requireAttemptOwnership(), getPaper);

// STAGE 4 additions — each takes requireAttemptOwnership before the handler.
attemptsRouter.get("/:attemptId/responses", requireAttemptOwnership(), getResponses);
attemptsRouter.patch("/:attemptId/responses", requireAttemptOwnership(), batchSaveResponses);
attemptsRouter.get("/:attemptId/events", requireAttemptOwnership(), getEvents);
attemptsRouter.post("/:attemptId/events", requireAttemptOwnership(), postEvent);
attemptsRouter.get("/:attemptId/scorecard", requireAttemptOwnership(), getScorecard);

router.use("/attempts", attemptsRouter);

export default router;
