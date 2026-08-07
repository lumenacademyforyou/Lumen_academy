import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import { explainWrongAnswer } from "../services/aiExplanation.service.js";

const router = Router();

router.use(requireAuth);

const explainBodySchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().min(1),
});

router.post("/explain", validate({ body: explainBodySchema }), async (req, res, next) => {
  try {
    const result = await explainWrongAnswer(req.user!.id, req.body.attemptId, req.body.questionId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
