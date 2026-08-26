/**
 * TE-P4 work item 8. Finds attempts past their effective deadline still
 * in_progress/paused and force-submits them with submitted_reason='sweeper'
 * — the backstop for attempts abandoned without a further request (D-6's
 * lazy enforcement, db/assess/test/attempt/expiry.ts, only fires when a
 * request happens to arrive). Idempotent (submitAttempt itself is, D-7) and
 * safe to run repeatedly — run manually or by a platform scheduler later,
 * per the brief; no queue or cron infrastructure is wired up here (out of
 * scope, brief §3.2).
 *
 * Usage: npx tsx db/scripts/sweep-expired-attempts.ts
 */
import { pool } from "../shared/pool.js";
import { submitAttempt } from "../assess/test/attempt/attempt-flow.js";

async function main() {
  const res = await pool.query<{ attempt_id: string; user_id: string }>(
    `select attempt_id, user_id
       from assess.attempt
      where attempt_state in ('in_progress', 'paused')
        and server_deadline is not null
        and (extract(epoch from server_deadline) * 1000 + paused_ms_total) < (extract(epoch from now()) * 1000)`
  );

  console.log(`found ${res.rowCount} expired attempt(s) still open`);
  let closed = 0;
  for (const row of res.rows) {
    try {
      const result = await submitAttempt(row.attempt_id, row.user_id, undefined, undefined, "sweeper");
      console.log(`  closed ${row.attempt_id}: obtained=${result.obtainedMarks}/${result.totalMarks} (idempotent=${result.idempotent})`);
      closed++;
    } catch (err) {
      console.error(`  FAILED to close ${row.attempt_id}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`closed ${closed}/${res.rowCount} attempt(s)`);
  await pool.end();
}

main().catch((err) => {
  console.error("sweep-expired-attempts failed:", err);
  process.exitCode = 1;
});
