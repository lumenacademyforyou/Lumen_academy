/**
 * getAttemptEnvelope (LA-BE-ENGINE-001 TE-P4). Everything the client needs
 * to render and resume an attempt, mode-agnostic (reads assess.attempt_question,
 * not assess.test_question — works for FIXED and BLUEPRINT alike). R-9:
 * correct options, correct numeric answers and solution text are excluded
 * at the query itself — content.question_option.is_correct and
 * content.question.numeric_answer/solution_text are never selected here.
 *
 * Shape adaptation from the brief's data contract: this schema has no
 * content_block table (docs/OPEN_ITEMS.md) — question content is one
 * stem_text/stem_format pair, not a blocks[] array. The envelope reflects
 * that real shape instead of inventing a blocks[] wrapper around it.
 */
import { pool } from "../../../shared/pool.js";
import { NotFoundError } from "../../../shared/errors.js";
import type { AttemptModel } from "./attempt.model.js";

export interface EnvelopeOption {
  optionId: string;
  optionLabel: string;
  optionText: string;
}

export interface EnvelopeQuestion {
  questionId: string;
  testSectionId: string;
  sequenceNo: number;
  format: string | null;
  marks: string;
  negativeMarks: string;
  stemText: string;
  stemFormat: string;
  options: EnvelopeOption[];
}

export interface EnvelopeSection {
  testSectionId: string;
  sectionName: string;
  sequenceNo: number;
  questionCount: number;
}

export interface EnvelopeResponse {
  questionId: string;
  selectedOptionId: string | null;
  numericAnswer: string | null;
  isMarkedForReview: boolean;
  hasAnswered: boolean;
}

export interface AttemptEnvelope {
  attemptId: string;
  attemptNo: number;
  status: string;
  serverNow: string;
  remainingSeconds: number;
  allowPause: boolean;
  test: { testId: string; title: string; durationMinutes: number | null };
  sections: EnvelopeSection[];
  questions: EnvelopeQuestion[];
  responses: EnvelopeResponse[];
}

/**
 * @throws {NotFoundError} attempt not found or not owned by userId
 */
export async function getAttemptEnvelope(attemptId: string, userId: string): Promise<AttemptEnvelope> {
  const attemptRes = await pool.query<AttemptModel & { server_deadline: string | null; paused_ms_total: string }>(
    `select * from assess.attempt where attempt_id = $1`,
    [attemptId]
  );
  if (attemptRes.rowCount === 0 || attemptRes.rows[0].user_id !== userId) {
    throw new NotFoundError("assess.attempt", attemptId);
  }
  const attempt = attemptRes.rows[0];

  const testRes = await pool.query<{ title: string; duration_minutes: number | null }>(
    `select title, duration_minutes from assess.test where test_id = $1`,
    [attempt.test_id]
  );

  const nowRes = await pool.query<{ now: string }>("select now() as now");
  const serverNow = nowRes.rows[0].now;
  const openPauseRes = await pool.query<{ paused_at: string }>(
    `select paused_at from assess.attempt_pause where attempt_id = $1 and resumed_at is null`,
    [attemptId]
  );
  // Frozen at the pause's start while paused, so a paused attempt's
  // remaining time doesn't keep draining in the client's view.
  const referenceNowMs = openPauseRes.rowCount && openPauseRes.rowCount > 0 ? new Date(openPauseRes.rows[0].paused_at).getTime() : new Date(serverNow).getTime();
  const deadlineMs = attempt.server_deadline ? new Date(attempt.server_deadline).getTime() + Number(attempt.paused_ms_total ?? 0) : null;
  const remainingSeconds = deadlineMs === null ? 0 : Math.max(0, Math.round((deadlineMs - referenceNowMs) / 1000));

  const sectionsRes = await pool.query<{ test_section_id: string; section_name: string; sequence_no: number; question_count: number | null }>(
    `select test_section_id, section_name, sequence_no, question_count from assess.test_section where test_id = $1 order by sequence_no`,
    [attempt.test_id]
  );

  const questionsRes = await pool.query<{
    question_id: string;
    test_section_id: string;
    sequence_no: number;
    marks: string;
    negative_marks: string;
    question_type: string | null;
    stem_text: string;
    stem_format: string;
  }>(
    `select aq.question_id, aq.test_section_id, aq.sequence_no, aq.marks, aq.negative_marks,
            q.question_type, q.stem_text, q.stem_format
       from assess.attempt_question aq
       join content.question q on q.question_id = aq.question_id
      where aq.attempt_id = $1
      order by aq.test_section_id, aq.sequence_no`,
    [attemptId]
  );

  const questionIds = questionsRes.rows.map((r) => r.question_id);
  // R-9: option_id/label/text ONLY — is_correct is never selected.
  const optionsRes = questionIds.length
    ? await pool.query<{ question_id: string; option_id: string; option_label: string; option_text: string }>(
        `select question_id, option_id, option_label, option_text
           from content.question_option
          where question_id = any($1::uuid[])
          order by display_order`,
        [questionIds]
      )
    : { rows: [] as { question_id: string; option_id: string; option_label: string; option_text: string }[] };
  const optionsByQuestion = new Map<string, EnvelopeOption[]>();
  for (const row of optionsRes.rows) {
    const list = optionsByQuestion.get(row.question_id) ?? [];
    list.push({ optionId: row.option_id, optionLabel: row.option_label, optionText: row.option_text });
    optionsByQuestion.set(row.question_id, list);
  }

  const responsesRes = await pool.query<{ question_id: string; option_id: string | null; numeric_answer: string | null; response_state: string }>(
    `select question_id, option_id, numeric_answer, response_state from assess.attempt_response where attempt_id = $1`,
    [attemptId]
  );

  return {
    attemptId: attempt.attempt_id,
    attemptNo: attempt.attempt_no,
    status: attempt.attempt_state,
    serverNow,
    remainingSeconds,
    allowPause: true, // no per-test "allow pause" setting exists live yet — see docs/OPEN_ITEMS.md
    test: { testId: attempt.test_id, title: testRes.rows[0]?.title ?? "", durationMinutes: testRes.rows[0]?.duration_minutes ?? null },
    sections: sectionsRes.rows.map((s) => ({
      testSectionId: s.test_section_id,
      sectionName: s.section_name,
      sequenceNo: s.sequence_no,
      questionCount: s.question_count ?? 0,
    })),
    questions: questionsRes.rows.map((q) => ({
      questionId: q.question_id,
      testSectionId: q.test_section_id,
      sequenceNo: q.sequence_no,
      format: q.question_type,
      marks: q.marks,
      negativeMarks: q.negative_marks,
      stemText: q.stem_text,
      stemFormat: q.stem_format,
      options: optionsByQuestion.get(q.question_id) ?? [],
    })),
    responses: responsesRes.rows.map((r) => ({
      questionId: r.question_id,
      selectedOptionId: r.option_id,
      numericAnswer: r.numeric_answer,
      isMarkedForReview: r.response_state === "marked_for_review",
      hasAnswered: r.response_state === "answered" || r.response_state === "marked_for_review",
    })),
  };
}
