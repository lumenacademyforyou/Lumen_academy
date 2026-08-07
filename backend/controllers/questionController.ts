import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ALL_QUESTIONS, BIOLOGY_QUESTIONS, CHEMISTRY_QUESTIONS, PHYSICS_QUESTIONS } from "../../database";
import { prisma } from "../db.js";
import { AppError } from "../middleware/errorHandler.js";

const countQuerySchema = z
  .object({
    unitId: z.string().min(1).optional(),
    topicId: z.string().min(1).optional(),
  })
  .refine((value) => Boolean(value.unitId) !== Boolean(value.topicId), {
    message: "Provide exactly one of unitId or topicId",
  });

export const getQuestionCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const parsed = countQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new AppError(400, "VALIDATION_ERROR", parsed.error.issues[0].message));
    return;
  }

  const { unitId, topicId } = parsed.data;

  try {
    const count = await prisma.question.count({
      where: {
        isActive: true,
        ...(unitId ? { unitId } : { topicId }),
      },
    });
    res.json({ count });
  } catch (err) {
    next(err);
  }
};

export const getQuestions = (req: Request, res: Response): void => {
  const subject = req.query.subject as string;
  if (subject === "biology") {
    res.json({ status: "success", count: BIOLOGY_QUESTIONS.length, questions: BIOLOGY_QUESTIONS });
    return;
  }
  if (subject === "chemistry") {
    res.json({ status: "success", count: CHEMISTRY_QUESTIONS.length, questions: CHEMISTRY_QUESTIONS });
    return;
  }
  if (subject === "physics") {
    res.json({ status: "success", count: PHYSICS_QUESTIONS.length, questions: PHYSICS_QUESTIONS });
    return;
  }
  res.json({ status: "success", count: ALL_QUESTIONS.length, questions: ALL_QUESTIONS });
};
