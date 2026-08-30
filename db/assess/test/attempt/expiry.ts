/**
 * D-6: auto-submission is enforced lazily, not by a scheduler. Call
 * enforceExpiry(attemptId) at the top of every attempt-scoped request
 * handler (TE-P6 wires this into middleware); if it forces a submission it
 * returns the resulting scorecard-shaped result instead of null, and the
 * caller should return THAT to the client instead of the originally
 * requested resource.
 */
import { pool } from "../../../shared/pool.js";
import { submitAttempt, type SubmitResult } from "./attempt-flow.js";

export async function enforceExpiry(attemptId: string, userId: string): Promise<SubmitResult | null> {
  const res = await pool.query<{ attempt_state: string; effective_deadline_ms: string | null }>(
    `select attempt_state,
            case when server_deadline is null then null
                 else (extract(epoch from server_deadline) * 1000 + paused_ms_total)::text
            end as effective_deadline_ms
       from assess.attempt
      where attempt_id = $1 and user_id = $2`,
    [attemptId, userId]
  );
  if (res.rowCount === 0) return null;
  const { attempt_state, effective_deadline_ms } = res.rows[0];
  if (attempt_state !== "in_progress" && attempt_state !== "paused") return null;
  if (effective_deadline_ms === null) return null;
  if (Date.now() <= Number(effective_deadline_ms)) return null;

  return submitAttempt(attemptId, userId, undefined, undefined, "expiry");
}

/**
 * BUG-03 (docs/assessment-tool-debug-plan.md) — enforceExpiry above was
 * written and documented ("TE-P6 wires this into middleware") but never
 * actually called from anywhere (confirmed live: zero references under
 * backend/src). That is the real root cause of the "ghost test / 0:00
 * evaluating" report: a genuinely-expired in_progress/paused attempt was
 * never force-closed, so it stayed "active" forever and the next login's
 * getActiveSession() picked it straight back up.
 *
 * This is the on-read reconciler the plan asks for (no cron/queue
 * infrastructure exists in this app — see db/scripts/sweep-expired-attempts.ts's
 * own header — so "on every read of this user's attempts" is the honest,
 * available choke point, wired into listOwnAttempts/getEnvelope). Also
 * closes every stale attempt for the user, not just the most recent one,
 * which matters because startAttempt has no unique-active-attempt guard
 * (fixed separately, see attempt-flow.ts) — more than one in_progress/paused
 * row can exist for one user, and each needs its own expiry check.
 *
 * BATCH_LIMIT: found live, testing this against a real account with a large
 * accumulated backlog of stale attempts (49 rows, from months of manual
 * test-harness runs against one shared script account) — each enforceExpiry
 * call runs a full submitAttempt scoring pass, which took several real
 * seconds per attempt in this environment. Reconciling a large backlog
 * fully, sequentially, one attempt at a time, would make the first request
 * after a long gap wait for the *entire* backlog before it could proceed —
 * a real, observed multi-minute stall, not a hang. A normal account never
 * has more than one or two stale rows, so this cap only ever matters for a
 * pathological backlog; a bounded number of rows per call still makes
 * steady progress on the backlog across subsequent calls (each one
 * processes the next batch).
 *
 * CONCURRENCY IS DELIBERATELY 1, NOT PARALLEL: tried >1 first and hit a real
 * Postgres deadlock (40P01) live — two of this same user's attempts being
 * submitted at once both tried to insert into assess.user_question_seen
 * (keyed on (user_id, question_id)) and each ended up waiting on a row lock
 * the other held. Concurrent submitAttempt calls are only even possible here
 * because reconciliation manufactures them artificially (a real user can
 * never submit two attempts at the same instant, so production code never
 * hits this); running the batch sequentially avoids the whole class of risk
 * rather than trying to prove no other shared-row contention exists
 * elsewhere in the scoring path.
 */
const RECONCILE_BATCH_LIMIT = 10;

export async function reconcileUserAttempts(userId: string): Promise<void> {
  const res = await pool.query<{ attempt_id: string }>(
    `select attempt_id from assess.attempt where user_id = $1 and attempt_state in ('in_progress', 'paused')
      order by started_at asc nulls first limit $2`,
    [userId, RECONCILE_BATCH_LIMIT]
  );
  for (const { attempt_id } of res.rows) {
    // One bad row (e.g. a data defect in old test-harness output, or a
    // transient lock conflict) must never block reconciling the rest of the
    // batch — it just stays in_progress/paused and gets retried on the next
    // call, same as if this row hadn't been due for expiry yet.
    await enforceExpiry(attempt_id, userId).catch((err) => {
      console.error(`reconcileUserAttempts: enforceExpiry failed for attempt ${attempt_id}:`, err);
    });
  }
}
