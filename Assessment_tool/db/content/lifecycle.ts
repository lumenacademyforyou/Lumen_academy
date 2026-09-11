import { pool } from "../shared/pool.js";
import { NotFoundError, InvalidStateTransitionError } from "../shared/errors.js";

/**
 * CL-4 — content lifecycle service (LA-PLAN-002 Day 2).
 *
 * State machine: draft -> in_review -> approved -> published -> retired,
 * plus in_review -> draft (rejection). content.question.lifecycle_status
 * already carries this exact vocabulary (ck_question_lifecycle,
 * 010_content_rich.sql) — this module is the only place that writes it, and
 * every write is paired with a content.question_review row, so the review
 * trail and the current status can never drift apart.
 *
 * RBAC is deliberately NOT checked here — that's backend/middleware/
 * requirePermission's job (content:submit_review / content:review_decide /
 * content:publish, seeded in db/scripts/seed/00_core_roles.ts), wired at the
 * HTTP layer (CL-5). This module only enforces the state machine itself
 * (a wrong-role caller and a wrong-state caller are different failure modes;
 * conflating them here would mean every future non-HTTP caller — a script,
 * a batch job — re-implements the RBAC check to get the same protection the
 * state machine already gives for free).
 */

export interface LifecycleTransitionResult {
  questionId: string;
  lifecycleStatus: string;
  reviewId: string;
}

async function currentStatus(client: { query: typeof pool.query }, questionId: string): Promise<{ lifecycleStatus: string; jobId: string }> {
  const res = await client.query<{ lifecycle_status: string; job_id: string }>(
    `select lifecycle_status, job_id from content.question where question_id = $1 for update`,
    [questionId]
  );
  if (res.rowCount === 0) throw new NotFoundError("content.question", questionId);
  return { lifecycleStatus: res.rows[0].lifecycle_status, jobId: res.rows[0].job_id };
}

async function transition(
  questionId: string,
  actorUserId: string,
  fromStates: string[],
  toState: string,
  verdict: string,
  note?: string,
  issueCodes?: string[]
): Promise<LifecycleTransitionResult> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const { lifecycleStatus, jobId } = await currentStatus(client, questionId);
    if (!fromStates.includes(lifecycleStatus)) {
      throw new InvalidStateTransitionError("content.question", lifecycleStatus, toState);
    }

    await client.query(`update content.question set lifecycle_status = $1 where question_id = $2`, [toState, questionId]);

    const reviewRes = await client.query<{ review_id: string }>(
      `insert into content.question_review
         (question_id, reviewer_user_id, job_id, reviewer_type, verdict, issue_codes, reviewer_note, reviewed_at)
       values ($1, $2, $3, 'human', $4, $5, $6, now())
       returning review_id`,
      [questionId, actorUserId, jobId, verdict, issueCodes ? JSON.stringify(issueCodes) : null, note ?? null]
    );

    await client.query("commit");
    return { questionId, lifecycleStatus: toState, reviewId: reviewRes.rows[0].review_id };
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * draft -> in_review.
 * @throws {NotFoundError} questionId doesn't exist
 * @throws {InvalidStateTransitionError} the question isn't currently draft
 */
export async function submitForReview(questionId: string, actorUserId: string, note?: string): Promise<LifecycleTransitionResult> {
  return transition(questionId, actorUserId, ["draft"], "in_review", "submitted", note);
}

/**
 * in_review -> approved, or in_review -> draft (rejected).
 * @throws {NotFoundError} questionId doesn't exist
 * @throws {InvalidStateTransitionError} the question isn't currently in_review
 */
export async function decideReview(
  questionId: string,
  actorUserId: string,
  decision: "approve" | "reject",
  note?: string,
  issueCodes?: string[]
): Promise<LifecycleTransitionResult> {
  return decision === "approve"
    ? transition(questionId, actorUserId, ["in_review"], "approved", "approved", note, issueCodes)
    : transition(questionId, actorUserId, ["in_review"], "draft", "rejected", note, issueCodes);
}

/**
 * approved -> published.
 * @throws {NotFoundError} questionId doesn't exist
 * @throws {InvalidStateTransitionError} the question isn't currently approved
 */
export async function publishQuestion(questionId: string, actorUserId: string, note?: string): Promise<LifecycleTransitionResult> {
  return transition(questionId, actorUserId, ["approved"], "published", "published", note);
}

/**
 * published -> retired.
 * @throws {NotFoundError} questionId doesn't exist
 * @throws {InvalidStateTransitionError} the question isn't currently published
 */
export async function retireQuestion(questionId: string, actorUserId: string, note?: string): Promise<LifecycleTransitionResult> {
  return transition(questionId, actorUserId, ["published"], "retired", "retired", note);
}

export async function listReviewHistory(questionId: string): Promise<
  { reviewId: string; verdict: string; reviewerUserId: string; reviewerNote: string | null; reviewedAt: string | null }[]
> {
  const res = await pool.query<{
    review_id: string;
    verdict: string;
    reviewer_user_id: string;
    reviewer_note: string | null;
    reviewed_at: string | null;
  }>(
    `select review_id, verdict, reviewer_user_id, reviewer_note, reviewed_at
       from content.question_review
      where question_id = $1
      order by reviewed_at nulls last`,
    [questionId]
  );
  return res.rows.map((r) => ({
    reviewId: r.review_id,
    verdict: r.verdict,
    reviewerUserId: r.reviewer_user_id,
    reviewerNote: r.reviewer_note,
    reviewedAt: r.reviewed_at,
  }));
}
