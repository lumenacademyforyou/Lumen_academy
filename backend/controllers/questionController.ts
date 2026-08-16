import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../../db/shared/pool.js";
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

const SUBJECT_NAME_TO_CODE: Record<string, string> = {
  physics: "PHY",
  chemistry: "CHEM",
  botany: "BOT",
  zoology: "ZOO",
};

const listQuerySchema = z.object({
  subject: z.enum(["physics", "chemistry", "botany", "zoology"]).optional(),
});

interface OptionRow {
  question_id: string;
  option_id: string;
  option_label: string;
  option_text: string;
}

// db/content-backed, real (non-mock). Deliberately different response shape
// from the retired mock version — see STOP GATE 5: the old shape included
// correctAnswerIndex/explanation directly, which is the answer key, and this
// route has no auth (public/student-scoped). No is_correct anywhere here.
export const getQuestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new AppError(400, "VALIDATION_ERROR", parsed.error.issues[0].message));
    return;
  }

  try {
    const subjectCode = parsed.data.subject ? SUBJECT_NAME_TO_CODE[parsed.data.subject] : undefined;
    const questionsRes = await pool.query<{
      question_id: string;
      question_uid: string;
      stem_text: string;
      question_type: string | null;
      difficulty_band: string | null;
      subject_code: string;
    }>(
      `select q.question_id, q.question_uid, q.stem_text, q.question_type, q.difficulty_band, s.subject_code
         from content.question q
         join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
         join catalog.subject s on s.subject_id = sn.subject_id
        where q.lifecycle_status = 'published'
          and ($1::text is null or s.subject_code = $1)
        order by q.question_id`,
      [subjectCode ?? null]
    );

    const questionIds = questionsRes.rows.map((r) => r.question_id);
    const optionsByQuestion = new Map<string, { id: string; label: string; text: string }[]>();
    if (questionIds.length > 0) {
      const optionsRes = await pool.query<OptionRow>(
        `select question_id, option_id, option_label, option_text
           from content.question_option
          where question_id = any($1)
          order by display_order`,
        [questionIds]
      );
      for (const row of optionsRes.rows) {
        const list = optionsByQuestion.get(row.question_id) ?? [];
        list.push({ id: row.option_id, label: row.option_label, text: row.option_text });
        optionsByQuestion.set(row.question_id, list);
      }
    }

    const questions = questionsRes.rows.map((q) => ({
      id: q.question_id,
      uid: q.question_uid,
      text: q.stem_text,
      type: q.question_type,
      difficulty: q.difficulty_band,
      subject: q.subject_code,
      options: optionsByQuestion.get(q.question_id) ?? [],
    }));

    res.json({ status: "success", count: questions.length, questions });
  } catch (err) {
    next(err);
  }
};
