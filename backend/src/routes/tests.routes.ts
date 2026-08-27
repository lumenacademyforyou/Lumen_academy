import { Router, type Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth.js";
import { validate } from "../middleware/validate.js";
import * as attemptService from "../services/attempt.service.js";
import { buildAnswerKeyPdf, buildQuestionPaperPdf, buildReportPdf, getAttemptForDownload } from "../services/pdfReport.service.js";

const router = Router();

router.use(requireAuth);

const createAttemptBodySchema = z
  .object({
    subjectId: z.string().min(1).optional(),
    unitId: z.string().min(1).optional(),
    topicId: z.string().min(1).optional(),
    count: z.number().int().positive().max(100),
    durationSeconds: z.number().int().positive().max(6 * 60 * 60),
  })
  .refine((value) => Boolean(value.subjectId) || Boolean(value.unitId) || Boolean(value.topicId), {
    message: "Provide at least one of subjectId, unitId or topicId",
  });

router.post("/", validate({ body: createAttemptBodySchema }), async (req, res, next) => {
  try {
    const result = await attemptService.createAttempt(req.user!.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

const attemptIdParamsSchema = z.object({ id: z.string().uuid() });

router.get("/:id", validate({ params: attemptIdParamsSchema }), async (req, res, next) => {
  try {
    const attempt = await attemptService.getAttempt(req.user!.id, req.params.id);
    res.json(attempt);
  } catch (err) {
    next(err);
  }
});

const recordAnswersBodySchema = z
  .array(
    z.object({
      questionId: z.string().min(1),
      selectedOptionId: z.string().min(1).nullable(),
      timeSpentMs: z.number().int().nonnegative(),
    }),
  )
  .min(1);

router.patch(
  "/:id/answers",
  validate({ params: attemptIdParamsSchema, body: recordAnswersBodySchema }),
  async (req, res, next) => {
    try {
      await attemptService.recordAnswers(req.user!.id, req.params.id, req.body);
      res.status(200).json({ status: "ok" });
    } catch (err) {
      next(err);
    }
  },
);

router.post("/:id/submit", validate({ params: attemptIdParamsSchema }), async (req, res, next) => {
  try {
    const result = await attemptService.submitAttempt(req.user!.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/result", validate({ params: attemptIdParamsSchema }), async (req, res, next) => {
  try {
    const result = await attemptService.getResult(req.user!.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

function sendPdf(res: Response, buffer: Buffer, filenamePrefix: string, attemptId: string): void {
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `${filenamePrefix}_${attemptId.slice(0, 8)}_${dateStr}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

router.get("/:id/download/question-paper", validate({ params: attemptIdParamsSchema }), async (req, res, next) => {
  try {
    const { result, locale } = await getAttemptForDownload(req.user!.id, req.params.id);
    const buffer = await buildQuestionPaperPdf(result, locale);
    sendPdf(res, buffer, "Lumen_Academy_Question_Paper", result.id);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/download/answer-key", validate({ params: attemptIdParamsSchema }), async (req, res, next) => {
  try {
    const { result, locale } = await getAttemptForDownload(req.user!.id, req.params.id);
    const buffer = await buildAnswerKeyPdf(result, locale);
    sendPdf(res, buffer, "Lumen_Academy_Answer_Key", result.id);
  } catch (err) {
    next(err);
  }
});

router.get("/:id/download/report", validate({ params: attemptIdParamsSchema }), async (req, res, next) => {
  try {
    const { result, locale } = await getAttemptForDownload(req.user!.id, req.params.id);
    const buffer = await buildReportPdf(result, locale);
    sendPdf(res, buffer, "Lumen_Academy_Report", result.id);
  } catch (err) {
    next(err);
  }
});

export default router;
