import { Router } from "express";
import { makeOwnedCrudRouter } from "../lib/dbCrudRouter.js";
import { attemptRepository } from "../../db/assess/test/attempt/attempt.repository.js";
import { startAttempt, saveResponse, submitAttempt } from "../controllers/attemptFlowController.js";

// Only assess.attempt is wired here — it has a direct user_id column, so
// makeOwnedCrudRouter's per-row ownership check applies directly. This is
// the exact case docs/design/LA-DBD-004_backend_schema_map.md calls out:
// "A student may never read another student's attempt."
//
// Deliberately NOT wired in this pass — all have a legitimate owner (the
// same student) but no *direct* user_id column, only a path back through
// attempt_id/scorecard_id; a correct router for them needs a join-aware
// ownership check this pass didn't build:
//   - attempt_response, attempt_event  (owned transitively via attempt.user_id)
//   - scorecard                         (owned transitively via attempt.user_id)
//   - section_score                     (owned transitively via scorecard -> attempt.user_id, two hops)
// Also not wired — not user-owned at all, tenant/admin-scoped:
//   - test, test_section, test_question, test_assignment
const router = Router();

const attemptsRouter = makeOwnedCrudRouter(attemptRepository, "user_id");
// Real attempt lifecycle (see backend/controllers/attemptFlowController.ts):
// these inherit the requireAuth that makeOwnedCrudRouter already applied above.
attemptsRouter.post("/start", startAttempt);
attemptsRouter.patch("/:attemptId/responses/:testQuestionId", saveResponse);
attemptsRouter.post("/:attemptId/submit", submitAttempt);

router.use("/attempts", attemptsRouter);

export default router;
