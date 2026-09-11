import { NextFunction, Request, Response } from "express";
import { AppError } from "../middleware/errorHandler.js";

// Retired. The old mock version scored a client-supplied answer map against
// database_sample/questions.ts's ALL_QUESTIONS by legacy numeric id, with no
// persistence and no auth — that request shape has no equivalent in the real
// schema (assess.attempt/attempt_response need a real test_id and
// test_question_id chain, established via POST /api/assess/attempts/start
// first). Not a shape-preserving rewire is possible here; the real
// replacement is POST /api/assess/attempts/start -> PATCH/POST the
// responses/submit endpoints under /api/assess/attempts/:attemptId, backed
// by db/assess/test/attempt/attempt-flow.ts (built and auth-verified in
// STOP GATE 4). No scoring logic lives here anymore.
export const submitAttempt = (_req: Request, _res: Response, next: NextFunction): void => {
  next(
    new AppError(
      410,
      "ENDPOINT_RETIRED",
      "POST /api/submit-attempt is retired. Start an attempt with POST /api/assess/attempts/start, " +
        "save answers via the responses endpoints, then POST /api/assess/attempts/:attemptId/submit."
    )
  );
};
