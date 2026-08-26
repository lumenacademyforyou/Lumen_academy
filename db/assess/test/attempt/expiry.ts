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
