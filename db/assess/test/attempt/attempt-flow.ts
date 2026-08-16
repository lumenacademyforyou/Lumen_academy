import { pool } from "../../../shared/pool.js";
import { NotFoundError, InvalidStateTransitionError, ForeignKeyViolationError } from "../../../shared/errors.js";
import type { AttemptModel } from "./attempt.model.js";
import type { AttemptResponseModel } from "./attempt_response/attempt_response.model.js";
import type { AttemptEventModel } from "./attempt_event/attempt_event.model.js";
import type { ScorecardModel } from "./scorecard/scorecard.model.js";
import type { SectionScoreModel } from "./scorecard/section_score/section_score.model.js";

/**
 * Attempt lifecycle queries that don't fit the generic single-table CRUD
 * pattern (db/shared/repository-helpers.ts): start needs an attempt_no
 * computed from prior attempts, autosave needs upsert-on-conflict semantics
 * (docs/design/LA-ARC-005_attempt_runtime.md's autosave contract), and both
 * enforce a cross-table rule this layer is responsible for:
 *   - a response's test_question must belong to the same test as its attempt
 *     (docs/design/LA-DBD-004_backend_schema_map.md, rule 3).
 *
 * SCORING CONVENTION (confirmed with the user, catalog.marking_scheme is
 * still empty so nothing existing contradicts this): incorrect_marks is
 * stored as a NEGATIVE number (e.g. -1), so a response's marks are always a
 * plain sum — no sign-flipping in code. Whoever populates marking_scheme
 * rows must follow this.
 *
 * LA-ARC-005 describes scoring as an async worker step; no worker/queue
 * exists in this codebase yet, so submitAttempt runs it synchronously inline
 * instead of enqueuing it.
 *
 * NOT implemented: numeric-answer grading (content.question.answer_tolerance
 * vs marking_scheme.numeric_tolerance_pct — the design pack doesn't say which
 * governs, or the tolerance formula, so those responses are left ungraded
 * rather than guessed at) and section_score (needs a per-section breakdown
 * this pass doesn't build) and percentile/rank_in_cohort (need other
 * students' scores on the same test to mean anything).
 */

export async function startAttempt(testId: string, userId: string): Promise<AttemptModel> {
  const testRes = await pool.query("select test_id from assess.test where test_id = $1", [testId]);
  if (testRes.rowCount === 0) {
    throw new ForeignKeyViolationError("assess.attempt", "test_id");
  }

  const countRes = await pool.query<{ n: string }>(
    "select count(*) as n from assess.attempt where test_id = $1 and user_id = $2",
    [testId, userId]
  );
  const attemptNo = Number(countRes.rows[0].n) + 1;

  const insertRes = await pool.query<AttemptModel>(
    `insert into assess.attempt (test_id, user_id, attempt_no, started_at, attempt_state)
     values ($1, $2, $3, now(), 'in_progress')
     returning *`,
    [testId, userId, attemptNo]
  );
  return insertRes.rows[0];
}

async function loadAttemptForUser(attemptId: string, userId: string): Promise<AttemptModel> {
  const res = await pool.query<AttemptModel>("select * from assess.attempt where attempt_id = $1", [attemptId]);
  if (res.rowCount === 0 || res.rows[0].user_id !== userId) {
    // Same 404-not-403 reasoning as backend/lib/dbCrudRouter.ts's owned router.
    throw new NotFoundError("assess.attempt", attemptId);
  }
  return res.rows[0];
}

export interface UpsertResponseInput {
  option_id?: string | null;
  selected_option_label?: string | null;
  numeric_answer?: number | null;
  time_spent_seconds?: number | null;
}

export async function upsertResponse(
  attemptId: string,
  testQuestionId: string,
  userId: string,
  data: UpsertResponseInput
): Promise<AttemptResponseModel> {
  const attempt = await loadAttemptForUser(attemptId, userId);
  if (attempt.attempt_state !== "in_progress") {
    throw new InvalidStateTransitionError("assess.attempt", attempt.attempt_state, "answer");
  }

  const tqRes = await pool.query(
    `select tq.test_question_id
       from assess.test_question tq
       join assess.test_section ts on ts.test_section_id = tq.test_section_id
      where tq.test_question_id = $1 and ts.test_id = $2`,
    [testQuestionId, attempt.test_id]
  );
  if (tqRes.rowCount === 0) {
    throw new ForeignKeyViolationError("assess.attempt_response", "test_question_id (must belong to the attempt's test)");
  }

  const res = await pool.query<AttemptResponseModel>(
    `insert into assess.attempt_response
       (attempt_id, test_question_id, option_id, selected_option_label, numeric_answer, time_spent_seconds, response_state, visit_count)
     values ($1, $2, $3, $4, $5, $6, 'answered', 1)
     on conflict (attempt_id, test_question_id) do update set
       option_id = excluded.option_id,
       selected_option_label = excluded.selected_option_label,
       numeric_answer = excluded.numeric_answer,
       time_spent_seconds = excluded.time_spent_seconds,
       response_state = 'answered',
       visit_count = assess.attempt_response.visit_count + 1
     returning *`,
    [
      attemptId,
      testQuestionId,
      data.option_id ?? null,
      data.selected_option_label ?? null,
      data.numeric_answer ?? null,
      data.time_spent_seconds ?? null,
    ]
  );
  return res.rows[0];
}

interface ScoreRow {
  test_question_id: string;
  marks_override: string | null;
  correct_marks: string;
  incorrect_marks: string;
  unattempted_marks: string;
  response_id: string | null;
  option_id: string | null;
  numeric_answer: string | null;
  option_is_correct: boolean | null;
}

export interface ScorecardResult {
  scorecardId: string;
  obtainedMarks: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  ungradedCount: number;
}

async function scoreAttempt(attemptId: string): Promise<ScorecardResult> {
  const rows = await pool.query<ScoreRow>(
    `select
       tq.test_question_id,
       tq.marks_override,
       ms.correct_marks,
       ms.incorrect_marks,
       ms.unattempted_marks,
       ar.response_id,
       ar.option_id,
       ar.numeric_answer,
       qo.is_correct as option_is_correct
     from assess.test_question tq
     join assess.test_section ts on ts.test_section_id = tq.test_section_id
     join catalog.pattern_section ps on ps.pattern_section_id = ts.pattern_section_id
     join catalog.marking_scheme ms on ms.scheme_id = ps.scheme_id
     left join assess.attempt_response ar on ar.test_question_id = tq.test_question_id and ar.attempt_id = $1
     left join content.question_option qo on qo.option_id = ar.option_id
     where ts.test_id = (select test_id from assess.attempt where attempt_id = $1)`,
    [attemptId]
  );

  let obtainedMarks = 0;
  let totalMarks = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;
  let ungradedCount = 0;
  const writeBacks: { responseId: string; marksAwarded: number; isCorrect: boolean }[] = [];

  for (const row of rows.rows) {
    const correctMarks = Number(row.marks_override ?? row.correct_marks);
    const incorrectMarks = Number(row.incorrect_marks);
    const unattemptedMarks = Number(row.unattempted_marks);
    totalMarks += correctMarks;

    if (row.response_id === null) {
      obtainedMarks += unattemptedMarks;
      skippedCount++;
      continue;
    }
    if (row.option_id !== null) {
      const isCorrect = row.option_is_correct === true;
      const marks = isCorrect ? correctMarks : incorrectMarks;
      obtainedMarks += marks;
      isCorrect ? correctCount++ : wrongCount++;
      writeBacks.push({ responseId: row.response_id, marksAwarded: marks, isCorrect });
      continue;
    }
    if (row.numeric_answer !== null) {
      // Numeric-answer grading not implemented — see file header.
      ungradedCount++;
      continue;
    }
    obtainedMarks += unattemptedMarks;
    skippedCount++;
  }

  for (const wb of writeBacks) {
    await pool.query("update assess.attempt_response set marks_awarded = $1, is_correct = $2 where response_id = $3", [
      wb.marksAwarded,
      wb.isCorrect,
      wb.responseId,
    ]);
  }

  const attemptedCount = correctCount + wrongCount;
  const accuracyPercent = attemptedCount > 0 ? (correctCount / attemptedCount) * 100 : 0;

  const scorecardRes = await pool.query<{ scorecard_id: string }>(
    `insert into assess.scorecard (attempt_id, obtained_marks, total_marks, accuracy_percent, generated_at)
     values ($1, $2, $3, $4, now())
     returning scorecard_id`,
    [attemptId, obtainedMarks, totalMarks, accuracyPercent]
  );

  return {
    scorecardId: scorecardRes.rows[0].scorecard_id,
    obtainedMarks,
    totalMarks,
    correctCount,
    wrongCount,
    skippedCount,
    ungradedCount,
  };
}

export interface SubmitResult {
  attempt: AttemptModel;
  scorecard: ScorecardResult;
}

export async function submitAttempt(attemptId: string, userId: string): Promise<SubmitResult> {
  const attempt = await loadAttemptForUser(attemptId, userId);
  if (attempt.attempt_state !== "in_progress") {
    throw new InvalidStateTransitionError("assess.attempt", attempt.attempt_state, "submitted");
  }

  await pool.query(`update assess.attempt set attempt_state = 'submitted', submitted_at = now() where attempt_id = $1`, [
    attemptId,
  ]);

  const scorecard = await scoreAttempt(attemptId);

  const finalRes = await pool.query<AttemptModel>(
    `update assess.attempt set attempt_state = 'scored' where attempt_id = $1 returning *`,
    [attemptId]
  );

  return { attempt: finalRes.rows[0], scorecard };
}

// ---------------------------------------------------------------------------
// STAGE 4 additions: responses/events/scorecard read+write for an attempt
// already known to belong to the caller. Ownership is verified ONCE per
// request by backend/middleware/ownership.ts's requireAttemptOwnership,
// before any of these run — they don't re-check it themselves.

export async function listResponses(attemptId: string): Promise<AttemptResponseModel[]> {
  const res = await pool.query<AttemptResponseModel>(
    "select * from assess.attempt_response where attempt_id = $1 order by response_id",
    [attemptId]
  );
  return res.rows;
}

export interface BatchResponseItem {
  testQuestionId: string;
  option_id?: string | null;
  selected_option_label?: string | null;
  numeric_answer?: number | null;
  time_spent_seconds?: number | null;
}

export async function batchUpsertResponses(attemptId: string, items: BatchResponseItem[]): Promise<AttemptResponseModel[]> {
  const attemptRes = await pool.query<AttemptModel>("select * from assess.attempt where attempt_id = $1", [attemptId]);
  if (attemptRes.rowCount === 0) throw new NotFoundError("assess.attempt", attemptId);
  const attempt = attemptRes.rows[0];
  if (attempt.attempt_state !== "in_progress") {
    throw new InvalidStateTransitionError("assess.attempt", attempt.attempt_state, "answer");
  }

  const results: AttemptResponseModel[] = [];
  for (const item of items) {
    // Not an ownership check (that's done once, above the caller) — a
    // per-item data-integrity check that the question actually belongs to
    // this attempt's test, same rule as the single-response upsertResponse.
    const tqRes = await pool.query(
      `select tq.test_question_id
         from assess.test_question tq
         join assess.test_section ts on ts.test_section_id = tq.test_section_id
        where tq.test_question_id = $1 and ts.test_id = $2`,
      [item.testQuestionId, attempt.test_id]
    );
    if (tqRes.rowCount === 0) {
      throw new ForeignKeyViolationError(
        "assess.attempt_response",
        `test_question_id ${item.testQuestionId} (must belong to the attempt's test)`
      );
    }
    const res = await pool.query<AttemptResponseModel>(
      `insert into assess.attempt_response
         (attempt_id, test_question_id, option_id, selected_option_label, numeric_answer, time_spent_seconds, response_state, visit_count)
       values ($1, $2, $3, $4, $5, $6, 'answered', 1)
       on conflict (attempt_id, test_question_id) do update set
         option_id = excluded.option_id,
         selected_option_label = excluded.selected_option_label,
         numeric_answer = excluded.numeric_answer,
         time_spent_seconds = excluded.time_spent_seconds,
         response_state = 'answered',
         visit_count = assess.attempt_response.visit_count + 1
       returning *`,
      [
        attemptId,
        item.testQuestionId,
        item.option_id ?? null,
        item.selected_option_label ?? null,
        item.numeric_answer ?? null,
        item.time_spent_seconds ?? null,
      ]
    );
    results.push(res.rows[0]);
  }
  return results;
}

export async function listEvents(attemptId: string): Promise<AttemptEventModel[]> {
  const res = await pool.query<AttemptEventModel>(
    "select * from assess.attempt_event where attempt_id = $1 order by event_at nulls last",
    [attemptId]
  );
  return res.rows;
}

// Append-only by design — no update/delete exposed anywhere for attempt_event.
export async function appendEvent(attemptId: string, eventType: string, payload?: unknown): Promise<AttemptEventModel> {
  const res = await pool.query<AttemptEventModel>(
    `insert into assess.attempt_event (attempt_id, event_type, event_at, event_payload)
     values ($1, $2, now(), $3)
     returning *`,
    [attemptId, eventType, payload === undefined ? null : JSON.stringify(payload)]
  );
  return res.rows[0];
}

// Read-only — scorecard/section_score are produced exclusively by
// submitAttempt's scoring step above, never written directly by a client.
export async function getScorecardWithSections(
  attemptId: string
): Promise<{ scorecard: ScorecardModel | null; sectionScores: SectionScoreModel[] }> {
  const scorecardRes = await pool.query<ScorecardModel>("select * from assess.scorecard where attempt_id = $1", [attemptId]);
  const scorecard = scorecardRes.rows[0] ?? null;
  if (!scorecard) return { scorecard: null, sectionScores: [] };
  const sectionRes = await pool.query<SectionScoreModel>("select * from assess.section_score where scorecard_id = $1", [
    scorecard.scorecard_id,
  ]);
  return { scorecard, sectionScores: sectionRes.rows };
}

// ---------------------------------------------------------------------------
// STAGE 7 addition — LA-ARC-005 describes GET /attempts/:id/paper: "questions
// WITHOUT keys, shuffled by seed, cached in Redis + IndexedDB." No shuffle
// seed or cache exists yet (no Redis wired up) — this returns questions in
// test_question.sequence_no order, unshuffled, uncached. Deliberately never
// includes is_correct anywhere in the shape, matching the same rule
// questionController.getQuestions already follows.

export interface PaperOption {
  option_id: string;
  option_label: string;
  option_text: string;
}

export interface PaperQuestion {
  test_question_id: string;
  sequence_no: number;
  question_id: string;
  stem_text: string;
  question_type: string | null;
  options: PaperOption[];
}

export async function getPaperForAttempt(attemptId: string): Promise<PaperQuestion[]> {
  const rows = await pool.query<{
    test_question_id: string;
    sequence_no: number;
    question_id: string;
    stem_text: string;
    question_type: string | null;
  }>(
    `select tq.test_question_id, tq.sequence_no, q.question_id, q.stem_text, q.question_type
       from assess.attempt a
       join assess.test_section ts on ts.test_id = a.test_id
       join assess.test_question tq on tq.test_section_id = ts.test_section_id
       join content.question q on q.question_id = tq.question_id
      where a.attempt_id = $1
      order by ts.sequence_no, tq.sequence_no`,
    [attemptId]
  );

  const questionIds = rows.rows.map((r) => r.question_id);
  const optionsByQuestion = new Map<string, PaperOption[]>();
  if (questionIds.length > 0) {
    const optionsRes = await pool.query<{ question_id: string } & PaperOption>(
      `select question_id, option_id, option_label, option_text
         from content.question_option
        where question_id = any($1)
        order by display_order`,
      [questionIds]
    );
    for (const row of optionsRes.rows) {
      const list = optionsByQuestion.get(row.question_id) ?? [];
      list.push({ option_id: row.option_id, option_label: row.option_label, option_text: row.option_text });
      optionsByQuestion.set(row.question_id, list);
    }
  }

  return rows.rows.map((r) => ({
    test_question_id: r.test_question_id,
    sequence_no: r.sequence_no,
    question_id: r.question_id,
    stem_text: r.stem_text,
    question_type: r.question_type,
    options: optionsByQuestion.get(r.question_id) ?? [],
  }));
}
