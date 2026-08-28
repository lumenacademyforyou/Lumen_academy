import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { pool } from "../../../db/shared/pool.js";
import { AppError } from "../middleware/errorHandler.js";
import { resolveAssetUrl } from "../../../db/content/asset-resolver.js";

export const SUBJECT_NAME_TO_CODE: Record<string, string> = {
  physics: "PHY",
  chemistry: "CHEM",
  botany: "BOT",
  zoology: "ZOO",
};

// Shared by getQuestionCount and getQuestions so the two endpoints can never
// disagree: same schema, same subject mapping, same published-only filter.
export const listQuerySchema = z.object({
  subject: z.enum(["physics", "chemistry", "botany", "zoology"]).optional(),
});

// Same subject filter and lifecycle_status = 'published' condition as
// getQuestions below — kept as one literal query string so a count and a
// list for the same filter are structurally guaranteed to agree.
const PUBLISHED_SUBJECT_FILTER = `
  from content.question q
  join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
  join catalog.subject s on s.subject_id = sn.subject_id
 where q.lifecycle_status = 'published'
   and ($1::text is null or s.subject_code = $1)`;

export const getQuestionCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(new AppError(400, "VALIDATION_ERROR", parsed.error.issues[0].message));
    return;
  }

  try {
    const subjectCode = parsed.data.subject ? SUBJECT_NAME_TO_CODE[parsed.data.subject] : undefined;
    const countRes = await pool.query<{ count: string }>(`select count(*)::text as count ${PUBLISHED_SUBJECT_FILTER}`, [
      subjectCode ?? null,
    ]);
    res.json({ count: Number(countRes.rows[0].count) });
  } catch (err) {
    next(err);
  }
};

interface OptionRow {
  question_id: string;
  option_id: string;
  option_label: string;
  option_text: string;
}

interface AssetRow {
  question_id: string;
  option_id: string | null;
  storage_uri: string;
  alt_text: string | null;
  target_role: string;
  asset_type: string;
}

// R-9 pre-submission discipline (see envelope.ts's header) applies to images
// exactly like it applies to is_correct: 'solution'/'hint'/'explanation'
// assets are answer-key-adjacent and must never reach a pre-attempt/in-attempt
// payload. Only stem/option assets — the question itself — are eligible here.
async function loadImagesByQuestion(questionIds: string[]): Promise<Map<string, { url: string; altText: string | null; optionId: string | null }[]>> {
  const byQuestion = new Map<string, { url: string; altText: string | null; optionId: string | null }[]>();
  if (questionIds.length === 0) return byQuestion;

  const assetsRes = await pool.query<AssetRow>(
    `select question_id, option_id, storage_uri, alt_text, target_role, asset_type
       from content.asset
      where question_id = any($1) and target_role in ('stem', 'option')
      order by display_order`,
    [questionIds]
  );
  for (const row of assetsRes.rows) {
    const list = byQuestion.get(row.question_id) ?? [];
    list.push({ url: resolveAssetUrl(row.storage_uri), altText: row.alt_text, optionId: row.option_id });
    byQuestion.set(row.question_id, list);
  }
  return byQuestion;
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
      has_image: boolean;
    }>(
      `select q.question_id, q.question_uid, q.stem_text, q.question_type, q.difficulty_band, s.subject_code, q.has_image
      ${PUBLISHED_SUBJECT_FILTER}
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
    const imagesByQuestion = await loadImagesByQuestion(questionIds);

    const questions = questionsRes.rows.map((q) => ({
      id: q.question_id,
      uid: q.question_uid,
      text: q.stem_text,
      type: q.question_type,
      difficulty: q.difficulty_band,
      subject: q.subject_code,
      hasImage: q.has_image,
      options: optionsByQuestion.get(q.question_id) ?? [],
      images: imagesByQuestion.get(q.question_id) ?? [],
    }));

    res.json({ status: "success", count: questions.length, questions });
  } catch (err) {
    next(err);
  }
};
