import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { makeOwnedCrudRouter } from "../lib/dbCrudRouter.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireAttemptOwnership } from "../middleware/ownership.js";
import { validate } from "../middleware/validate.js";
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
  getEnvelope,
  pauseAttempt,
  resumeAttempt,
  getReviewHandler,
  listOwnAttempts,
} from "../controllers/attemptFlowController.js";
import { createPracticeTest } from "../../db/assess/test/definition/create-practice-test.js";
import { pool } from "../../db/shared/pool.js";

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
attemptsRouter.patch("/:attemptId/responses/:questionId", saveResponse);
attemptsRouter.post("/:attemptId/submit", submitAttempt);
attemptsRouter.get("/:attemptId/paper", requireAttemptOwnership(), getPaper);

// STAGE 4 additions — each takes requireAttemptOwnership before the handler.
attemptsRouter.get("/:attemptId/responses", requireAttemptOwnership(), getResponses);
attemptsRouter.patch("/:attemptId/responses", requireAttemptOwnership(), batchSaveResponses);
attemptsRouter.get("/:attemptId/events", requireAttemptOwnership(), getEvents);
attemptsRouter.post("/:attemptId/events", requireAttemptOwnership(), postEvent);
attemptsRouter.get("/:attemptId/scorecard", requireAttemptOwnership(), getScorecard);

// TE-P4/TE-P5 additions, wired to HTTP for the first time in this pass.
// GET / (list) is safe to add here: makeOwnedCrudRouter only ever registers
// /:id routes (GET/PATCH/DELETE), never a bare GET /, so there's no collision.
attemptsRouter.get("/", listOwnAttempts);
attemptsRouter.get("/:attemptId/envelope", requireAttemptOwnership(), getEnvelope);
attemptsRouter.post("/:attemptId/pause", requireAttemptOwnership(), pauseAttempt);
attemptsRouter.post("/:attemptId/resume", requireAttemptOwnership(), resumeAttempt);
attemptsRouter.get("/:attemptId/review", requireAttemptOwnership(), getReviewHandler);

router.use("/attempts", attemptsRouter);

// ---------------------------------------------------------------------------
// Test creation — subject/chapter/topic/unit-wise practice tests
// (db/assess/test/definition/create-practice-test.ts). No HTTP surface for
// creating any kind of test existed anywhere before this route; test-TAKING
// was already fully wired above. Open to any authenticated user creating a
// test for themselves (self-serve chapter practice, same as any other
// consumer test-prep app) — not gated behind a content:* permission, since
// this creates an assess.test/test_blueprint shape, not content.
const createPracticeTestSchema = z.object({
  examId: z.string().uuid(),
  examCode: z.string().min(1),
  testType: z.enum(["SUBJ", "CHAP", "TOPIC", "UNIT"]), // MOCK excluded — multi-line, not this single-scope shape
  scopeCode: z.string().min(1),
  title: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  subjectId: z.string().uuid(),
  syllabusNodeId: z.string().uuid().optional(),
  includeDescendants: z.boolean().optional(),
  difficultyBand: z.enum(["easy", "medium", "hard"]).optional(),
  pickCount: z.number().int().positive(),
  sectionName: z.string().min(1),
});

router.post("/tests/practice", requireAuth, validate({ body: createPracticeTestSchema }), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const b = req.body;
    const test = await createPracticeTest({
      examId: b.examId,
      examCode: b.examCode,
      testType: b.testType,
      scopeCode: b.scopeCode,
      title: b.title,
      durationMinutes: b.durationMinutes,
      createdBy: req.user!.appUserId,
      lines: [
        {
          subjectId: b.subjectId,
          syllabusNodeId: b.syllabusNodeId ?? null,
          includeDescendants: b.includeDescendants ?? true,
          difficultyBand: b.difficultyBand ?? null,
          pickCount: b.pickCount,
          sectionName: b.sectionName,
        },
      ],
    });
    // createTest() always starts a test at 'draft' (content-review-style
    // gating makes sense for shared/authored content, not for a student's
    // own ad-hoc practice test) — publish immediately so the creator can
    // actually start an attempt on it without a separate manual step.
    await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [test.testId]);
    res.status(201).json({ data: { ...test, testStatus: "published" } });
  } catch (err) {
    next(err);
  }
});

export default router;
