/**
 * D-6: auto-submission is enforced lazily, not by a scheduler. Call
 * enforceExpiry(attemptId) at the top of every attempt-scoped request
 * handler (TE-P6 wires this into middleware); if it forces a submission it
 * returns the resulting scorecard-shaped result instead of null, and the
 * caller should return THAT to the client instead of the originally
 * requested resource.
 */
import { pool } from "../../../shared/pool.js";
import { submitAttempt, abandonAttempt, type SubmitResult, type AbandonResult } from "./attempt-flow.js";

/**
 * Test-layer hardening C1: an expired attempt with literally zero saved
 * responses (the student opened it and never touched anything) is routed to
 * `abandoned` instead of being force-scored as if it were a genuine, if
 * empty, submission — see abandonAttempt's own docstring in attempt-flow.ts
 * for the full policy reasoning. Anything with at least one response, no
 * matter how partial, still goes through the unchanged submitAttempt path.
 */
async function closeExpiredAttempt(attemptId: string, userId: string, reason: "expiry" | "sweeper"): Promise<SubmitResult | AbandonResult> {
  const res = await pool.query<{ count: string }>(`select count(*) from assess.attempt_response where attempt_id = $1`, [attemptId]);
  if (Number(res.rows[0].count) === 0) {
    return abandonAttempt(attemptId, userId, reason);
  }
  return submitAttempt(attemptId, userId, undefined, undefined, reason);
}

/**
 * Live regression, found while chasing a "can't resume the paused test"
 * report: `paused_ms_total` is only credited retroactively, inside
 * resumeAttempt's own transaction, once a pause actually ends (attempt-flow.ts)
 * — it does NOT grow while a pause is still open. That means the
 * `effective_deadline_ms` computation below (server_deadline + paused_ms_total)
 * does not account for the *current*, still-open pause at all, so a student
 * who pauses for longer than whatever time was left on the clock looked
 * "expired" to this check even though pausing is this app's own sanctioned
 * "stop the clock and come back later" mechanism (same reasoning
 * attemptLockdown.ts's B8 allowlist already documents for why `paused`
 * exam-navigation lockdown doesn't apply). Confirmed live: a real paused
 * attempt with 0 responses sat ~9 minutes from being force-closed by
 * exactly this stale formula, via either the next reconcileUserAttempts
 * call or the 60s sweeper — whichever fired first would have force-closed
 * (post-C1: abandoned) a legitimately paused, still-resumable attempt out
 * from under the student before they ever got to click Resume.
 *
 * Fix: expiry enforcement only ever applies to `in_progress` attempts.
 * Pausing suspends deadline enforcement entirely, for as long as it's
 * paused — resuming (resumeAttempt) is what correctly re-anchors the clock
 * via its own paused_ms_total credit, and only then does this check apply
 * again.
 */
export async function enforceExpiry(attemptId: string, userId: string): Promise<SubmitResult | AbandonResult | null> {
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
  if (attempt_state !== "in_progress") return null;
  if (effective_deadline_ms === null) return null;
  if (Date.now() <= Number(effective_deadline_ms)) return null;

  return closeExpiredAttempt(attemptId, userId, "expiry");
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

export interface SweepResult {
  found: number;
  closed: number;
  abandoned: number;
  failed: number;
}

/**
 * Test-layer hardening C3: everything above this function (enforceExpiry,
 * reconcileUserAttempts) is *lazy* — it only ever runs when a request for
 * that specific user happens to arrive. A user who goes offline right at
 * their deadline and never opens the app again (never hits /envelope,
 * /attempts, or starts a new test) leaves their attempt `in_progress`
 * forever — confirmed live: db/scripts/sweep-expired-attempts.ts already
 * had the right one-off query for this, but its own header admits "no
 * queue or cron infrastructure is wired up here... run manually or by a
 * platform scheduler later," and grepping every config file in this repo
 * confirmed it never actually was.
 *
 * This is that same logic, extracted so both the manual script and the
 * in-process scheduler (backend/src/jobs/expirySweeper.ts) share one
 * implementation instead of drifting apart. Deliberately sequential (a
 * plain for-loop, one submitAttempt at a time) — the same reasoning as
 * RECONCILE_BATCH_LIMIT above: concurrent submitAttempt calls for
 * *different* users are fine in principle, but a Postgres deadlock was
 * already found live when two of the same user's attempts scored
 * concurrently on assess.user_question_seen; a plain sequential sweep
 * across all users avoids re-opening that question entirely for the sake
 * of a background job nothing is waiting on synchronously.
 */
export async function sweepExpiredAttempts(): Promise<SweepResult> {
  // Same fix as enforceExpiry above (see its own docstring for the full
  // "paused_ms_total doesn't credit an open pause until resume" story) —
  // `paused` attempts are never swept, only `in_progress` ones. Without
  // this, a 60-second sweeper tick could force-close a legitimately paused
  // attempt while the student is deliberately mid-break, exactly the
  // "can't resume the paused test" failure mode this was found chasing.
  const res = await pool.query<{ attempt_id: string; user_id: string }>(
    `select attempt_id, user_id
       from assess.attempt
      where attempt_state = 'in_progress'
        and server_deadline is not null
        and (extract(epoch from server_deadline) * 1000 + paused_ms_total) < (extract(epoch from now()) * 1000)`
  );

  let closed = 0;
  let abandoned = 0;
  let failed = 0;
  for (const row of res.rows) {
    try {
      const result = await closeExpiredAttempt(row.attempt_id, row.user_id, "sweeper");
      if ("abandoned" in result) abandoned++;
      else closed++;
    } catch (err) {
      failed++;
      console.error(`sweepExpiredAttempts: FAILED to close attempt ${row.attempt_id}:`, err instanceof Error ? err.message : err);
    }
  }
  return { found: res.rowCount ?? 0, closed, abandoned, failed };
}
