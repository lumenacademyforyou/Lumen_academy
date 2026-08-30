import { pool } from "../../../shared/pool.js";
import {
  NotFoundError,
  InvalidStateTransitionError,
  ForeignKeyViolationError,
  IdempotencyConflictError,
  TestNotPublishedError,
  TestWindowClosedError,
  QuestionNotInAttemptError,
  InvalidNumericAnswerError,
  ScoringRuleMissingError,
  ReviewNotAvailableError,
  ActiveAttemptExistsError,
} from "../../../shared/errors.js";
import { reconcileUserAttempts } from "./expiry.js";
import type { AttemptModel } from "./attempt.model.js";
import type { AttemptResponseModel } from "./attempt_response/attempt_response.model.js";
import type { AttemptEventModel } from "./attempt_event/attempt_event.model.js";
import type { ScorecardModel } from "./scorecard/scorecard.model.js";
import type { SectionScoreModel } from "./scorecard/section_score/section_score.model.js";
import { assembleForAttempt } from "../generation/assemble.js";
import { evaluateResponse } from "../../scoring/evaluate.js";
import { aggregateAttempt, type SectionInput } from "../../scoring/aggregate.js";
import * as decimal from "../../scoring/decimal.js";
import type { EvaluatedResponse, PartialMode, QuestionFormat, ScoringRule, ServedQuestion, StudentResponse } from "../../scoring/types.js";
import { resolveAssetUrl } from "../../../content/asset-resolver.js";
import { deriveSessionModeFromTestCode } from "../definition/test-code.js";

/**
 * TE-P4 rewrite (LA-BE-ENGINE-001 Section 6). Every function here now goes
 * through assess.attempt_question (db/migrations/020_attempt_question.sql)
 * as the uniform "what was this attempt actually served" source, so the
 * same code path handles FIXED and BLUEPRINT mode without branching on
 * assembly_mode. Scoring is delegated to db/assess/scoring/* (TE-P2) — this
 * file's job is orchestration and persistence, not marking-rule logic
 * (D-3: no exam-name branching anywhere here).
 *
 * getPaperForAttempt (below, unchanged) predates this rewrite and only
 * covers FIXED mode (it reads assess.test_question directly) — superseded
 * by db/assess/test/attempt/envelope.ts's getAttemptEnvelope for anything
 * BLUEPRINT-aware. Left in place rather than deleted: attemptFlowController.ts
 * still calls it, and retiring the route it backs is TE-P6's job, not this
 * phase's.
 */

async function loadAttemptForUser(attemptId: string, userId: string, client: { query: typeof pool.query } = pool): Promise<AttemptModel> {
  const res = await (client as typeof pool).query<AttemptModel>("select * from assess.attempt where attempt_id = $1", [attemptId]);
  if (res.rowCount === 0 || res.rows[0].user_id !== userId) {
    // Same 404-not-403 reasoning as backend/lib/dbCrudRouter.ts's owned router.
    throw new NotFoundError("assess.attempt", attemptId);
  }
  return res.rows[0];
}

// ---------------------------------------------------------------------------
// startAttempt

interface SectionSchemeRow {
  test_section_id: string;
  pattern_section_id: string;
  correct_marks: string;
  incorrect_marks: string;
}

// BUG-03 (docs/assessment-tool-debug-plan.md) fallout — found live, not
// guessed: both call sites run this from inside an already-open transaction
// (a `client` checked out via pool.connect()), but this always called
// pool.query() directly instead of using that client — requesting a SECOND
// connection from the same pool while the first was still held open.
// db/shared/pool.ts caps the whole pool at 4 connections; running 4 of these
// transactions at once (which this session's own reconciliation-concurrency
// fix for the same bug started doing) deadlocks every one of them forever,
// each waiting for a 5th connection that can only ever free up once one of
// the other 4 finishes — which none of them can, since they're all stuck
// the same way. Confirmed live via pg_stat_activity: 4 backends sitting
// "idle in transaction" on the query right before this call, indefinitely.
async function loadSectionSchemes(testId: string, client: { query: typeof pool.query } = pool): Promise<Map<string, SectionSchemeRow>> {
  const res = await client.query<SectionSchemeRow>(
    `select ts.test_section_id, ts.pattern_section_id, ms.correct_marks, ms.incorrect_marks
       from assess.test_section ts
       join catalog.v_section_marking vsm on vsm.pattern_section_id = ts.pattern_section_id
       join catalog.marking_scheme ms on ms.scheme_id = vsm.effective_scheme_id
      where ts.test_id = $1`,
    [testId]
  );
  return new Map(res.rows.map((r) => [r.test_section_id, r]));
}

export interface StartAttemptResult {
  attemptId: string;
  attemptNo: number;
  attemptState: string;
  serverDeadline: string | null;
  idempotent: boolean;
}

/**
 * @throws {NotFoundError} testId does not exist
 * @throws {TestNotPublishedError} the test exists but isn't published
 * @throws {TestWindowClosedError} outside the test's availability window
 * @throws {IdempotencyConflictError} idempotencyKey was already used for a different test
 */
export async function startAttempt(testId: string, userId: string, idempotencyKey?: string): Promise<StartAttemptResult> {
  // BUG-03/BUG-08 (docs/assessment-tool-debug-plan.md): startAttempt never
  // checked for an existing in_progress/paused attempt before this fix — the
  // only guard was a duplicate-attempt_no race retry (below), which does
  // nothing to stop two *different* tests both being "active" for one user
  // at once. Reconcile first (a genuinely-expired attempt must never block a
  // fresh start), then check what's left; ActiveAttemptExistsError carries
  // the real attempt id so the caller can offer resume-or-submit instead of
  // silently allowing a second concurrent attempt (the actual mechanism
  // behind the reported "ghost test" / cross-test bleed symptoms).
  if (idempotencyKey) {
    const existing = await pool.query<{ response_body: StartAttemptResult; subject_id: string }>(
      `select response_body, subject_id from assess.idempotency_key where key = $1 and user_id = $2 and operation = 'attempt_start'`,
      [idempotencyKey, userId]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      if (existing.rows[0].subject_id !== testId) {
        throw new IdempotencyConflictError(idempotencyKey);
      }
      return { ...existing.rows[0].response_body, idempotent: true };
    }
  }

  await reconcileUserAttempts(userId);
  const activeRes = await pool.query<{ attempt_id: string; test_id: string }>(
    `select attempt_id, test_id from assess.attempt where user_id = $1 and attempt_state in ('in_progress', 'paused') limit 1`,
    [userId]
  );
  if (activeRes.rowCount && activeRes.rowCount > 0) {
    throw new ActiveAttemptExistsError(activeRes.rows[0].attempt_id, activeRes.rows[0].test_id);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const testRes = await client.query<{ test_id: string; test_status: string; window_opens_at: string | null; window_closes_at: string | null; duration_minutes: number | null; source_type: string }>(
      `select test_id, test_status, window_opens_at, window_closes_at, duration_minutes, source_type from assess.test where test_id = $1 for share`,
      [testId]
    );
    if (testRes.rowCount === 0) throw new NotFoundError("assess.test", testId);
    const test = testRes.rows[0];
    if (test.test_status !== "published") throw new TestNotPublishedError(testId, test.test_status);
    const nowRes = await client.query<{ now: string }>("select now() as now");
    const now = new Date(nowRes.rows[0].now).getTime();
    if (test.window_opens_at && now < new Date(test.window_opens_at).getTime()) throw new TestWindowClosedError(testId);
    if (test.window_closes_at && now > new Date(test.window_closes_at).getTime()) throw new TestWindowClosedError(testId);

    // Bounded retry on the attempt_no race (docs/ENGINE_STATE.md §3(c)) —
    // count-then-insert instead of a lock held across BLUEPRINT assembly,
    // per the brief's own instruction.
    let attempt: AttemptModel | null = null;
    let lastErr: unknown;
    for (let tries = 0; tries < 5 && !attempt; tries++) {
      const countRes = await client.query<{ n: string }>("select count(*) as n from assess.attempt where test_id = $1 and user_id = $2", [testId, userId]);
      const attemptNo = Number(countRes.rows[0].n) + 1;
      try {
        const insertRes = await client.query<AttemptModel>(
          `insert into assess.attempt (test_id, user_id, attempt_no, started_at, server_deadline, attempt_state)
           values ($1, $2, $3, now(), now() + make_interval(mins => $4), 'in_progress')
           returning *`,
          [testId, userId, attemptNo, test.duration_minutes ?? 60]
        );
        attempt = insertRes.rows[0];
      } catch (err) {
        lastErr = err;
        if ((err as { code?: string }).code !== "23505") throw err;
        // another concurrent request took this attempt_no — retry with a fresh count
      }
    }
    if (!attempt) throw lastErr instanceof Error ? lastErr : new Error("startAttempt: exhausted retries allocating attempt_no");

    const sectionSchemes = await loadSectionSchemes(testId, client);

    // Bulk-inserted via unnest() rather than one awaited round trip per
    // question (LA-APP-COMPLETION-001 Phase F finding: a full-mock's 180
    // sequential inserts measured ~14s against the real remote database —
    // see docs/APP_COMPLETION_PLAN.md's Phase F section). Same
    // (attempt_id, question_id, test_section_id, sequence_no, marks,
    // negative_marks) rows as before, in one insert instead of N.
    const bulkQuestionIds: string[] = [];
    const bulkTestSectionIds: string[] = [];
    const bulkSequenceNos: number[] = [];
    const bulkMarks: string[] = [];
    const bulkNegativeMarks: string[] = [];

    // P0-3 (docs/assessment-tool-fix-prompt.md): the one place both the
    // BLUEPRINT (assembleForAttempt) and FIXED (assess.test_question) paths
    // funnel through before the same question_id could ever reach a served
    // attempt twice — assess.attempt_question's PK is (attempt_id,
    // question_id), so a duplicate here would otherwise surface as a raw
    // 23505 failure on the bulk insert below (source: FIXED papers can
    // legally repeat a question_id across two different sections;
    // ingestFixedPaper only rejects duplicates within one section, not
    // across the whole paper — see its own header comment). Deduping here,
    // once, covers both sources instead of trusting each producer.
    const seenQuestionIds = new Set<string>();
    let skippedDuplicates = 0;
    const pushServedQuestion = (questionId: string, testSectionId: string, sequenceNo: number, marks: string, negativeMarks: string) => {
      if (seenQuestionIds.has(questionId)) {
        skippedDuplicates++;
        return;
      }
      seenQuestionIds.add(questionId);
      bulkQuestionIds.push(questionId);
      bulkTestSectionIds.push(testSectionId);
      bulkSequenceNos.push(sequenceNo);
      bulkMarks.push(marks);
      bulkNegativeMarks.push(negativeMarks);
    };

    if (test.source_type === "generated") {
      const assembled = await assembleForAttempt(testId, userId);
      await client.query("update assess.attempt set generation_seed = $1 where attempt_id = $2", [assembled.seed, attempt.attempt_id]);
      for (const section of assembled.sections) {
        const scheme = sectionSchemes.get(section.testSectionId);
        if (!scheme) throw new ScoringRuleMissingError("(blueprint section)", section.testSectionId);
        let seq = 1;
        for (const questionId of section.questionIds) {
          pushServedQuestion(questionId, section.testSectionId, seq, scheme.correct_marks, scheme.incorrect_marks);
          seq++;
        }
      }
    } else {
      const tqRes = await client.query<{ test_section_id: string; question_id: string; sequence_no: number; marks_override: string | null }>(
        `select tq.test_section_id, tq.question_id, tq.sequence_no, tq.marks_override
           from assess.test_question tq
           join assess.test_section ts on ts.test_section_id = tq.test_section_id
          where ts.test_id = $1
          order by ts.sequence_no, tq.sequence_no`,
        [testId]
      );
      for (const row of tqRes.rows) {
        const scheme = sectionSchemes.get(row.test_section_id);
        if (!scheme) throw new ScoringRuleMissingError(row.question_id, row.test_section_id);
        pushServedQuestion(row.question_id, row.test_section_id, row.sequence_no, row.marks_override ?? scheme.correct_marks, scheme.incorrect_marks);
      }
    }

    if (skippedDuplicates > 0) {
      console.warn(`startAttempt: test ${testId} attempted to serve ${skippedDuplicates} duplicate question_id(s) — deduped before persisting attempt ${attempt.attempt_id}.`);
    }

    if (bulkQuestionIds.length > 0) {
      await client.query(
        `insert into assess.attempt_question (attempt_id, question_id, test_section_id, sequence_no, marks, negative_marks)
         select $1, q, ts, seq, m, nm
           from unnest($2::uuid[], $3::uuid[], $4::smallint[], $5::numeric[], $6::numeric[]) as t(q, ts, seq, m, nm)`,
        [attempt.attempt_id, bulkQuestionIds, bulkTestSectionIds, bulkSequenceNos, bulkMarks, bulkNegativeMarks]
      );
    }

    await client.query(
      `insert into assess.attempt_event (attempt_id, event_type, event_at) values ($1, 'ATTEMPT_STARTED', now())`,
      [attempt.attempt_id]
    );

    const result: StartAttemptResult = {
      attemptId: attempt.attempt_id,
      attemptNo: attempt.attempt_no,
      attemptState: attempt.attempt_state,
      serverDeadline: attempt.server_deadline,
      idempotent: false,
    };

    if (idempotencyKey) {
      await client.query(
        `insert into assess.idempotency_key (key, user_id, operation, subject_id, response_body) values ($1, $2, 'attempt_start', $3, $4)`,
        [idempotencyKey, userId, testId, JSON.stringify(result)]
      );
    }

    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// pause / resume (D-1/R-10)

export async function pauseAttempt(attemptId: string, userId: string): Promise<void> {
  const attempt = await loadAttemptForUser(attemptId, userId);
  if (attempt.attempt_state !== "in_progress") {
    throw new InvalidStateTransitionError("assess.attempt", attempt.attempt_state, "paused");
  }
  await pool.query(`insert into assess.attempt_pause (attempt_id) values ($1)`, [attemptId]);
  await pool.query(`update assess.attempt set attempt_state = 'paused' where attempt_id = $1`, [attemptId]);
  await pool.query(`insert into assess.attempt_event (attempt_id, event_type, event_at) values ($1, 'ATTEMPT_PAUSED', now())`, [attemptId]);
}

export async function resumeAttempt(attemptId: string, userId: string): Promise<void> {
  const attempt = await loadAttemptForUser(attemptId, userId);
  if (attempt.attempt_state !== "paused") {
    throw new InvalidStateTransitionError("assess.attempt", attempt.attempt_state, "in_progress");
  }
  const client = await pool.connect();
  try {
    await client.query("begin");
    const openPause = await client.query<{ pause_id: string; paused_at: string }>(
      `select pause_id, paused_at from assess.attempt_pause where attempt_id = $1 and resumed_at is null for update`,
      [attemptId]
    );
    if (openPause.rowCount === 0) throw new InvalidStateTransitionError("assess.attempt_pause", "none-open", "resumed");
    const elapsedMs = await client.query<{ ms: string }>(
      `select extract(epoch from (now() - $1::timestamptz)) * 1000 as ms`,
      [openPause.rows[0].paused_at]
    );
    await client.query(`update assess.attempt_pause set resumed_at = now() where pause_id = $1`, [openPause.rows[0].pause_id]);
    await client.query(
      `update assess.attempt set attempt_state = 'in_progress', paused_ms_total = paused_ms_total + $1 where attempt_id = $2`,
      [Math.round(Number(elapsedMs.rows[0].ms)), attemptId]
    );
    await client.query(`insert into assess.attempt_event (attempt_id, event_type, event_at) values ($1, 'ATTEMPT_RESUMED', now())`, [attemptId]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// upsertResponse / batchUpsertResponses — keyed by question_id, validated
// against assess.attempt_question (mode-agnostic). The option_id/question
// match itself is enforced by assess.trg_attempt_response_option_guard
// (SQLSTATE LM001 -> RESPONSE_OPTION_MISMATCH, backend/middleware/errorHandler.ts).

export interface UpsertResponseInput {
  optionId?: string | null;
  selectedOptionLabel?: string | null;
  numericAnswer?: string | null;
  timeSpentSeconds?: number | null;
  isMarkedForReview?: boolean;
}

const NUMERIC_PATTERN = /^-?\d+(\.\d+)?$/;

async function resolveTestQuestionId(attemptId: string, questionId: string): Promise<string | null> {
  const res = await pool.query<{ test_question_id: string }>(
    `select tq.test_question_id
       from assess.attempt_question aq
       join assess.test_question tq on tq.test_section_id = aq.test_section_id and tq.question_id = aq.question_id
      where aq.attempt_id = $1 and aq.question_id = $2`,
    [attemptId, questionId]
  );
  return res.rows[0]?.test_question_id ?? null;
}

/**
 * @throws {NotFoundError} attempt not found or not owned by userId
 * @throws {InvalidStateTransitionError} attempt is not in_progress
 * @throws {QuestionNotInAttemptError} questionId was not served in this attempt
 * @throws {InvalidNumericAnswerError} numericAnswer doesn't parse as NUMERIC
 */
export async function upsertResponse(
  attemptId: string,
  questionId: string,
  userId: string,
  data: UpsertResponseInput
): Promise<AttemptResponseModel> {
  const attempt = await loadAttemptForUser(attemptId, userId);
  if (attempt.attempt_state !== "in_progress") {
    throw new InvalidStateTransitionError("assess.attempt", attempt.attempt_state, "answer");
  }
  const served = await pool.query(`select 1 from assess.attempt_question where attempt_id = $1 and question_id = $2`, [attemptId, questionId]);
  if (served.rowCount === 0) throw new QuestionNotInAttemptError(attemptId, questionId);
  if (data.numericAnswer != null && !NUMERIC_PATTERN.test(data.numericAnswer)) {
    throw new InvalidNumericAnswerError(data.numericAnswer);
  }

  const testQuestionId = await resolveTestQuestionId(attemptId, questionId);
  const responseState = data.isMarkedForReview ? "marked_for_review" : "answered";

  const res = await pool.query<AttemptResponseModel>(
    `insert into assess.attempt_response
       (attempt_id, test_question_id, question_id, option_id, selected_option_label, numeric_answer, time_spent_seconds, response_state, visit_count)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 1)
     on conflict (attempt_id, question_id) do update set
       test_question_id = excluded.test_question_id,
       option_id = excluded.option_id,
       selected_option_label = excluded.selected_option_label,
       numeric_answer = excluded.numeric_answer,
       time_spent_seconds = excluded.time_spent_seconds,
       response_state = excluded.response_state,
       visit_count = assess.attempt_response.visit_count + 1
     returning *`,
    [
      attemptId,
      testQuestionId,
      questionId,
      data.optionId ?? null,
      data.selectedOptionLabel ?? null,
      data.numericAnswer ?? null,
      data.timeSpentSeconds ?? null,
      responseState,
    ]
  );
  return res.rows[0];
}

export interface BatchResponseItem extends UpsertResponseInput {
  questionId: string;
  answeredAt?: string | null;
}

export interface BatchResponseResult {
  questionId: string;
  ok: boolean;
  response?: AttemptResponseModel;
  error?: string;
}

/**
 * Per-item result, never all-or-nothing (brief TE-P4 work item 4) — one
 * malformed item never loses the rest of an autosave batch. A later
 * client-supplied answeredAt for the same question wins (checked against
 * the already-stored row's updated_at proxy — this table has no answeredAt
 * column of its own; visit_count/time_spent_seconds are overwritten
 * unconditionally on every accepted item, same as upsertResponse).
 */
export async function batchUpsertResponses(attemptId: string, userId: string, items: BatchResponseItem[]): Promise<BatchResponseResult[]> {
  const attempt = await loadAttemptForUser(attemptId, userId);
  if (attempt.attempt_state !== "in_progress") {
    throw new InvalidStateTransitionError("assess.attempt", attempt.attempt_state, "answer");
  }
  const results: BatchResponseResult[] = [];
  for (const item of items) {
    try {
      const response = await upsertResponse(attemptId, item.questionId, userId, item);
      results.push({ questionId: item.questionId, ok: true, response });
    } catch (err) {
      results.push({ questionId: item.questionId, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// submitAttempt — one transaction, SELECT ... FOR UPDATE, idempotent (D-7),
// integrates the TE-P2 scoring engine, updates the D-2 seen ledger.

export interface SubmitResult {
  scorecardId: string;
  obtainedMarks: string;
  totalMarks: string;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  unattemptedCount: number;
  idempotent: boolean;
}

function mapQuestionFormat(questionType: string | null): QuestionFormat | null {
  switch (questionType) {
    case "single_choice":
    case "true_false":
      return "MCQ_SINGLE";
    case "multi_choice":
      return "MCQ_MULTI";
    case "integer":
    case "numeric":
      return "NUMERICAL";
    case "assertion_reason":
      return "ASSERTION_REASON";
    default:
      return null; // matrix_match and anything else: out of pilot scope (D-8)
  }
}

function mapPartialMode(partialCreditRule: string | null): PartialMode {
  const normalized = (partialCreditRule ?? "").toLowerCase();
  if (normalized === "proportional") return "PROPORTIONAL";
  if (normalized === "jee_adv_2019") return "JEE_ADV_2019";
  return "NONE";
}

interface ServedRow {
  question_id: string;
  test_section_id: string;
  marks: string;
  negative_marks: string;
  question_type: string | null;
  numeric_answer: string | null;
  answer_tolerance: string | null;
  option_id: string | null;
  numeric_answer_given: string | null;
  time_spent_seconds: number | null;
}

/**
 * @throws {NotFoundError} attempt not found or not owned by userId
 * @throws {InvalidStateTransitionError} attempt is in a state this can't act on (e.g. never started)
 * @throws {IdempotencyConflictError} idempotencyKey was already used for a different attempt
 * @throws {ScoringRuleMissingError} a served question's section has no resolvable marking scheme
 */
export async function submitAttempt(
  attemptId: string,
  userId: string,
  idempotencyKey?: string,
  finalResponses?: BatchResponseItem[],
  reason: "student" | "expiry" | "admin" | "sweeper" = "student"
): Promise<SubmitResult> {
  if (idempotencyKey) {
    const existing = await pool.query<{ response_body: SubmitResult; subject_id: string }>(
      `select response_body, subject_id from assess.idempotency_key where key = $1 and user_id = $2 and operation = 'attempt_submit'`,
      [idempotencyKey, userId]
    );
    if (existing.rowCount && existing.rowCount > 0) {
      if (existing.rows[0].subject_id !== attemptId) throw new IdempotencyConflictError(idempotencyKey);
      return { ...existing.rows[0].response_body, idempotent: true };
    }
  }

  if (finalResponses && finalResponses.length > 0) {
    await batchUpsertResponses(attemptId, userId, finalResponses);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const attemptRes = await client.query<AttemptModel>(`select * from assess.attempt where attempt_id = $1 for update`, [attemptId]);
    if (attemptRes.rowCount === 0 || attemptRes.rows[0].user_id !== userId) throw new NotFoundError("assess.attempt", attemptId);
    const attempt = attemptRes.rows[0];

    // D-7: already scored — return the stored scorecard, not an error.
    if (attempt.attempt_state === "scored") {
      const scorecardRes = await client.query<ScorecardModel>(`select * from assess.scorecard where attempt_id = $1`, [attemptId]);
      const sc = scorecardRes.rows[0];
      const counts = await client.query<{ correct: string; incorrect: string; partial: string; unattempted: string }>(
        `select
           count(*) filter (where is_correct = true) as correct,
           count(*) filter (where is_correct = false) as incorrect,
           0 as partial, 0 as unattempted
         from assess.attempt_response where attempt_id = $1`,
        [attemptId]
      );
      await client.query("commit");
      return {
        scorecardId: sc.scorecard_id,
        obtainedMarks: String(sc.obtained_marks),
        totalMarks: String(sc.total_marks),
        correctCount: Number(counts.rows[0].correct),
        incorrectCount: Number(counts.rows[0].incorrect),
        partialCount: 0,
        unattemptedCount: 0,
        idempotent: true,
      };
    }
    if (attempt.attempt_state !== "in_progress" && attempt.attempt_state !== "paused") {
      throw new InvalidStateTransitionError("assess.attempt", attempt.attempt_state, "submitted");
    }

    const servedRes = await client.query<ServedRow>(
      `select aq.question_id, aq.test_section_id, aq.marks, aq.negative_marks,
              q.question_type, q.numeric_answer, q.answer_tolerance,
              ar.option_id, ar.numeric_answer as numeric_answer_given, ar.time_spent_seconds
         from assess.attempt_question aq
         join content.question q on q.question_id = aq.question_id
         left join assess.attempt_response ar on ar.attempt_id = aq.attempt_id and ar.question_id = aq.question_id
        where aq.attempt_id = $1
        order by aq.test_section_id, aq.sequence_no`,
      [attemptId]
    );

    const questionIds = servedRes.rows.map((r) => r.question_id);
    const optionsRes = questionIds.length
      ? await client.query<{ question_id: string; option_id: string; is_correct: boolean }>(
          `select question_id, option_id, is_correct from content.question_option where question_id = any($1::uuid[])`,
          [questionIds]
        )
      : { rows: [] as { question_id: string; option_id: string; is_correct: boolean }[] };
    const correctOptionsByQuestion = new Map<string, string[]>();
    const allOptionsByQuestion = new Map<string, string[]>();
    for (const row of optionsRes.rows) {
      if (row.is_correct) correctOptionsByQuestion.set(row.question_id, [...(correctOptionsByQuestion.get(row.question_id) ?? []), row.option_id]);
      allOptionsByQuestion.set(row.question_id, [...(allOptionsByQuestion.get(row.question_id) ?? []), row.option_id]);
    }

    const sectionSchemes = await loadSectionSchemes(attempt.test_id, client);
    const bySection = new Map<string, { rows: ServedRow[] }>();
    for (const row of servedRes.rows) {
      const entry = bySection.get(row.test_section_id) ?? { rows: [] };
      entry.rows.push(row);
      bySection.set(row.test_section_id, entry);
    }

    const evaluatedById = new Map<string, EvaluatedResponse>();
    const sectionInputs: SectionInput[] = [];
    for (const [testSectionId, { rows }] of bySection) {
      const scheme = sectionSchemes.get(testSectionId);
      if (!scheme) throw new ScoringRuleMissingError("(section)", testSectionId);
      const schemeFullRes = await client.query<{ unattempted_marks: string; partial_credit_rule: string | null; numeric_tolerance_pct: string | null }>(
        `select ms.unattempted_marks, ms.partial_credit_rule, ms.numeric_tolerance_pct
           from assess.test_section ts
           join catalog.v_section_marking vsm on vsm.pattern_section_id = ts.pattern_section_id
           join catalog.marking_scheme ms on ms.scheme_id = vsm.effective_scheme_id
          where ts.test_section_id = $1`,
        [testSectionId]
      );
      const fullScheme = schemeFullRes.rows[0];

      const evaluated: EvaluatedResponse[] = [];
      for (const row of rows) {
        const format = mapQuestionFormat(row.question_type);
        if (!format) {
          throw new ScoringRuleMissingError(row.question_id, testSectionId); // matrix_match etc. — out of pilot scope (D-8)
        }
        const rule: ScoringRule = {
          ruleId: `${testSectionId}:${format}`,
          questionFormat: format,
          correctMarks: row.marks,
          incorrectMarks: row.negative_marks,
          unattemptedMarks: fullScheme.unattempted_marks,
          partialMode: mapPartialMode(fullScheme.partial_credit_rule),
          numericToleranceAbs: format === "NUMERICAL" ? row.answer_tolerance : null,
          numericToleranceRelPct: fullScheme.numeric_tolerance_pct,
          voidDisposition: "EXCLUDED", // no live is_voided concept — see docs/OPEN_ITEMS.md
        };
        const question: ServedQuestion = {
          questionId: row.question_id,
          format,
          ruleId: rule.ruleId,
          isVoided: false,
          correctOptionIds: correctOptionsByQuestion.get(row.question_id) ?? [],
          correctNumericValue: row.numeric_answer,
          optionIds: allOptionsByQuestion.get(row.question_id) ?? [],
        };
        const hasResponse = row.option_id !== null || row.numeric_answer_given !== null;
        const response: StudentResponse | undefined = hasResponse
          ? {
              questionId: row.question_id,
              selectedOptionIds: row.option_id ? [row.option_id] : [],
              numericValue: row.numeric_answer_given,
              isMarkedForReview: false,
              answeredAt: "1970-01-01T00:00:00.000Z", // presence, not timing, is what evaluateResponse checks
            }
          : undefined;
        const result = evaluateResponse(question, response, rule);
        evaluated.push(result);
        evaluatedById.set(row.question_id, result);
      }
      sectionInputs.push({
        sectionId: testSectionId,
        responses: evaluated,
        totalAvailableMarks: decimal.sum(rows.map((r) => r.marks)),
      });
    }

    const aggregate = aggregateAttempt(sectionInputs);

    for (const [questionId, evaluatedResponse] of evaluatedById) {
      await client.query(
        `update assess.attempt_response set marks_awarded = $1, is_correct = $2 where attempt_id = $3 and question_id = $4`,
        [evaluatedResponse.marksAwarded, evaluatedResponse.outcome === "CORRECT", attemptId, questionId]
      );
    }

    const correctCount = [...evaluatedById.values()].filter((r) => r.outcome === "CORRECT").length;
    const incorrectCount = [...evaluatedById.values()].filter((r) => r.outcome === "INCORRECT").length;
    const partialCount = [...evaluatedById.values()].filter((r) => r.outcome === "PARTIAL").length;
    const unattemptedCount = [...evaluatedById.values()].filter((r) => r.outcome === "UNATTEMPTED").length;
    const attemptedCount = correctCount + incorrectCount + partialCount;
    const accuracyPercent = attemptedCount > 0 ? decimal.multiply(decimal.divide(String(correctCount), String(attemptedCount)), "100") : "0";

    const scorecardRes = await client.query<{ scorecard_id: string }>(
      `insert into assess.scorecard (attempt_id, obtained_marks, total_marks, accuracy_percent, generated_at)
       values ($1, $2, $3, $4, now())
       returning scorecard_id`,
      [attemptId, aggregate.totalMarks, aggregate.totalAvailableMarks, accuracyPercent]
    );

    for (const section of aggregate.sections) {
      const avgTimeRes = await client.query<{ avg_seconds: string | null }>(
        `select avg(time_spent_seconds) as avg_seconds
           from assess.attempt_response ar
           join assess.attempt_question aq on aq.attempt_id = ar.attempt_id and aq.question_id = ar.question_id
          where ar.attempt_id = $1 and aq.test_section_id = $2 and ar.time_spent_seconds is not null`,
        [attemptId, section.sectionId]
      );
      await client.query(
        `insert into assess.section_score (scorecard_id, test_section_id, obtained_marks, attempted_count, correct_count, average_time_seconds)
         values ($1, $2, $3, $4, $5, $6)`,
        [
          scorecardRes.rows[0].scorecard_id,
          section.sectionId,
          section.subtotalMarks,
          section.correctCount + section.incorrectCount + section.partialCount,
          section.correctCount,
          avgTimeRes.rows[0].avg_seconds,
        ]
      );
    }

    const nextSeqRes = await client.query<{ next_seq: string }>(
      `select coalesce(max(attempt_seq), 0) + 1 as next_seq from assess.attempt where user_id = $1 and attempt_state = 'scored'`,
      [userId]
    );
    const attemptSeq = Number(nextSeqRes.rows[0].next_seq);

    await client.query(
      `update assess.attempt set attempt_state = 'scored', submitted_at = coalesce(submitted_at, now()), submitted_reason = coalesce(submitted_reason, $1), attempt_seq = $2 where attempt_id = $3`,
      [reason, attemptSeq, attemptId]
    );

    for (const [questionId, evaluatedResponse] of evaluatedById) {
      await client.query(
        `insert into assess.user_question_seen (user_id, question_id, last_seen_attempt_seq, was_correct_last)
         values ($1, $2, $3, $4)
         on conflict (user_id, question_id) do update set
           last_seen_at = now(),
           times_seen = assess.user_question_seen.times_seen + 1,
           last_seen_attempt_seq = excluded.last_seen_attempt_seq,
           was_correct_last = excluded.was_correct_last`,
        [userId, questionId, attemptSeq, evaluatedResponse.outcome === "CORRECT"]
      );
    }

    await client.query(`insert into assess.attempt_event (attempt_id, event_type, event_at) values ($1, 'ATTEMPT_SUBMITTED', now())`, [attemptId]);

    const result: SubmitResult = {
      scorecardId: scorecardRes.rows[0].scorecard_id,
      obtainedMarks: aggregate.totalMarks,
      totalMarks: aggregate.totalAvailableMarks,
      correctCount,
      incorrectCount,
      partialCount,
      unattemptedCount,
      idempotent: false,
    };

    if (idempotencyKey) {
      await client.query(
        `insert into assess.idempotency_key (key, user_id, operation, subject_id, response_body) values ($1, $2, 'attempt_submit', $3, $4)`,
        [idempotencyKey, userId, attemptId, JSON.stringify(result)]
      );
    }

    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
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

export interface SectionScoreWithName extends SectionScoreModel {
  section_name: string;
  question_count: number | null;
}

export interface ScorecardTiming {
  started_at: string | null;
  submitted_at: string | null;
  allotted_minutes: number | null;
}

// Read-only — scorecard/section_score are produced exclusively by
// submitAttempt's scoring step above, never written directly by a client.
// P1-10 (docs/assessment-tool-fix-prompt.md's detailed report — "time taken
// vs allotted" and a named section-wise breakdown) is why section_name and
// attempt/test timing were added here rather than left for the frontend to
// cross-reference against a second call: this is already the one query scoped
// to exactly this attempt's scorecard, so it's the natural place to also
// answer "how long did this take, out of how long they had" and "which
// section is section X" — not a second question-count round trip either
// (`question_count` here is `assess.test_section.question_count`, the same
// count is used to know a section's total independent of who attempted what).
export async function getScorecardWithSections(
  attemptId: string
): Promise<{ scorecard: ScorecardModel | null; sectionScores: SectionScoreWithName[]; timing: ScorecardTiming | null }> {
  const scorecardRes = await pool.query<ScorecardModel>("select * from assess.scorecard where attempt_id = $1", [attemptId]);
  const scorecard = scorecardRes.rows[0] ?? null;
  if (!scorecard) return { scorecard: null, sectionScores: [], timing: null };

  const sectionRes = await pool.query<SectionScoreWithName>(
    `select ss.*, ts.section_name, ts.question_count
       from assess.section_score ss
       join assess.test_section ts on ts.test_section_id = ss.test_section_id
      where ss.scorecard_id = $1
      order by ts.sequence_no`,
    [scorecard.scorecard_id]
  );

  const timingRes = await pool.query<ScorecardTiming>(
    `select a.started_at, a.submitted_at, t.duration_minutes as allotted_minutes
       from assess.attempt a
       join assess.test t on t.test_id = a.test_id
      where a.attempt_id = $1`,
    [attemptId]
  );

  return { scorecard, sectionScores: sectionRes.rows, timing: timingRes.rows[0] ?? null };
}

// ---------------------------------------------------------------------------
// STAGE 7 addition — LA-ARC-005 describes GET /attempts/:id/paper: "questions
// WITHOUT keys, shuffled by seed, cached in Redis + IndexedDB." No shuffle
// seed or cache exists yet (no Redis wired up) — this returns questions in
// test_question.sequence_no order, unshuffled, uncached. Deliberately never
// includes is_correct anywhere in the shape, matching the same rule
// questionController.getQuestions already follows.
//
// FIXED-mode only (reads assess.test_question directly) — left unchanged by
// the TE-P4 rewrite. envelope.ts's getAttemptEnvelope is the mode-agnostic,
// answer-key-excluding replacement; this stays for backward compatibility
// with the currently-mounted GET .../paper route until TE-P6 retires it.

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

// ---------------------------------------------------------------------------
// TE-P5 — getReview / listAttempts (LA-PLAN-002 Day 2, G7 depends on this).
// Both are pure reads of already-persisted values — unlike getAttemptEnvelope
// (R-9: never leaks the key pre-submission), getReview's whole point is to
// reveal is_correct/correctOptionIds/marks_awarded, but only once
// submitAttempt has actually written them (attempt_state = 'scored').
// Neither function here recomputes a score; getScorecardWithSections above
// already covers "read the persisted scorecard" — this section adds the
// per-question walkthrough and the attempt list, which didn't exist yet.

export interface ReviewOption {
  optionId: string;
  optionLabel: string;
  optionText: string;
  isCorrect: boolean;
  wasSelected: boolean;
}

export interface ReviewImage {
  url: string;
  altText: string | null;
  optionId: string | null;
  targetRole: string;
}

export interface ReviewQuestion {
  questionId: string;
  testSectionId: string;
  sequenceNo: number;
  stemText: string;
  questionType: string | null;
  topicTagCode: string;
  topicTitle: string;
  options: ReviewOption[];
  images: ReviewImage[];
  correctNumericValue: string | null;
  studentNumericAnswer: string | null;
  isCorrect: boolean | null;
  marksAwarded: string | null;
  timeSpentSeconds: number | null;
  explanationText: string | null;
  formulaReference: string | null;
}

interface ReviewRow {
  question_id: string;
  test_section_id: string;
  sequence_no: number;
  stem_text: string;
  question_type: string | null;
  numeric_answer: string | null;
  tag_code: string;
  topic_title: string;
  explanation_text: string | null;
  formula_reference: string | null;
  selected_option_id: string | null;
  student_numeric_answer: string | null;
  is_correct: boolean | null;
  marks_awarded: string | null;
  time_spent_seconds: number | null;
}

/**
 * @throws {NotFoundError} attemptId doesn't exist or doesn't belong to userId
 * @throws {ReviewNotAvailableError} the attempt hasn't been scored yet
 */
export async function getReview(attemptId: string, userId: string): Promise<ReviewQuestion[]> {
  const attempt = await loadAttemptForUser(attemptId, userId);
  if (attempt.attempt_state !== "scored") {
    throw new ReviewNotAvailableError(attemptId, attempt.attempt_state);
  }

  const rows = await pool.query<ReviewRow>(
    `select aq.question_id, aq.test_section_id, aq.sequence_no,
            q.stem_text, q.question_type, q.numeric_answer,
            sn.tag_code, sn.title as topic_title,
            qs.explanation_text, qs.formula_reference,
            ar.option_id as selected_option_id, ar.numeric_answer as student_numeric_answer,
            ar.is_correct, ar.marks_awarded, ar.time_spent_seconds
       from assess.attempt_question aq
       join content.question q on q.question_id = aq.question_id
       join catalog.syllabus_node sn on sn.node_id = q.primary_node_id
       left join content.question_solution qs on qs.question_id = q.question_id
       left join assess.attempt_response ar on ar.attempt_id = aq.attempt_id and ar.question_id = aq.question_id
      where aq.attempt_id = $1
      order by aq.test_section_id, aq.sequence_no`,
    [attemptId]
  );

  const questionIds = rows.rows.map((r) => r.question_id);
  const optionsByQuestion = new Map<string, ReviewOption[]>();
  if (questionIds.length > 0) {
    const optionsRes = await pool.query<{ question_id: string; option_id: string; option_label: string; option_text: string; is_correct: boolean }>(
      `select question_id, option_id, option_label, option_text, is_correct
         from content.question_option
        where question_id = any($1::uuid[])
        order by display_order`,
      [questionIds]
    );
    for (const r of rows.rows) {
      const list: ReviewOption[] = [];
      for (const row of optionsRes.rows) {
        if (row.question_id !== r.question_id) continue;
        list.push({
          optionId: row.option_id,
          optionLabel: row.option_label,
          optionText: row.option_text,
          isCorrect: row.is_correct,
          wasSelected: row.option_id === r.selected_option_id,
        });
      }
      optionsByQuestion.set(r.question_id, list);
    }
  }

  // Post-scoring: unlike envelope.ts/questionController.ts, no target_role
  // restriction — solution/hint/explanation assets (none exist yet, but the
  // schema allows them) are fair to reveal here, same as explanation_text
  // and is_correct already are on this endpoint.
  const imagesByQuestion = new Map<string, ReviewImage[]>();
  if (questionIds.length > 0) {
    const assetsRes = await pool.query<{ question_id: string; option_id: string | null; storage_uri: string; alt_text: string | null; target_role: string }>(
      `select question_id, option_id, storage_uri, alt_text, target_role
         from content.asset
        where question_id = any($1::uuid[])
        order by display_order`,
      [questionIds]
    );
    for (const row of assetsRes.rows) {
      const list = imagesByQuestion.get(row.question_id) ?? [];
      list.push({ url: resolveAssetUrl(row.storage_uri), altText: row.alt_text, optionId: row.option_id, targetRole: row.target_role });
      imagesByQuestion.set(row.question_id, list);
    }
  }

  return rows.rows.map((r) => ({
    questionId: r.question_id,
    testSectionId: r.test_section_id,
    sequenceNo: r.sequence_no,
    stemText: r.stem_text,
    questionType: r.question_type,
    topicTagCode: r.tag_code,
    topicTitle: r.topic_title,
    options: optionsByQuestion.get(r.question_id) ?? [],
    images: imagesByQuestion.get(r.question_id) ?? [],
    correctNumericValue: r.numeric_answer,
    studentNumericAnswer: r.student_numeric_answer,
    isCorrect: r.is_correct,
    marksAwarded: r.marks_awarded,
    timeSpentSeconds: r.time_spent_seconds,
    explanationText: r.explanation_text,
    formulaReference: r.formula_reference,
  }));
}

export interface AttemptSummary {
  attemptId: string;
  testId: string;
  testCode: string;
  testTitle: string;
  // P1-11 (docs/assessment-tool-fix-prompt.md's "View results" list) — same
  // derivation dashboard.ts/envelope.ts already use elsewhere; test_mode
  // itself is never populated (createPracticeTest never passes it through
  // to createTest), so the test_code's own TEST_TYPE segment is the one
  // reliable source, not a DB column.
  mode: "subject-wise" | "full-mock" | "custom";
  durationMinutes: number | null;
  attemptNo: number;
  attemptState: string;
  startedAt: string | null;
  submittedAt: string | null;
  obtainedMarks: string | null;
  totalMarks: string | null;
}

/** Lists a user's own attempts, most recent first. Optionally scoped to one test. Never recomputes a score — left join onto the persisted scorecard only. */
export async function listAttempts(userId: string, testId?: string): Promise<AttemptSummary[]> {
  const res = await pool.query<{
    attempt_id: string;
    test_id: string;
    test_code: string;
    test_title: string;
    duration_minutes: number | null;
    attempt_no: number;
    attempt_state: string;
    started_at: string | null;
    submitted_at: string | null;
    obtained_marks: string | null;
    total_marks: string | null;
  }>(
    `select a.attempt_id, a.test_id, t.test_code, t.title as test_title, t.duration_minutes, a.attempt_no, a.attempt_state,
            a.started_at, a.submitted_at, sc.obtained_marks, sc.total_marks
       from assess.attempt a
       join assess.test t on t.test_id = a.test_id
       left join assess.scorecard sc on sc.attempt_id = a.attempt_id
      where a.user_id = $1 ${testId ? "and a.test_id = $2" : ""}
      order by a.started_at desc nulls last`,
    testId ? [userId, testId] : [userId]
  );

  return res.rows.map((r) => ({
    attemptId: r.attempt_id,
    testId: r.test_id,
    testCode: r.test_code,
    testTitle: r.test_title,
    mode: deriveSessionModeFromTestCode(r.test_code),
    durationMinutes: r.duration_minutes,
    attemptNo: r.attempt_no,
    attemptState: r.attempt_state,
    startedAt: r.started_at,
    submittedAt: r.submitted_at,
    obtainedMarks: r.obtained_marks,
    totalMarks: r.total_marks,
  }));
}
