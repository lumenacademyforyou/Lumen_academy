/**
 * TE-P4 work item 8. Finds attempts past their effective deadline still
 * in_progress/paused and force-submits them with submitted_reason='sweeper'
 * — the backstop for attempts abandoned without a further request (D-6's
 * lazy enforcement, db/assess/test/attempt/expiry.ts, only fires when a
 * request happens to arrive).
 *
 * Test-layer hardening C3: the actual sweep logic now lives in
 * sweepExpiredAttempts (expiry.ts), shared with the in-process scheduler
 * (backend/src/jobs/expirySweeper.ts) that runs this automatically — this
 * script remains for manual/one-off runs (e.g. clearing a backlog by hand,
 * or running it via an external platform scheduler instead of the in-process
 * one) rather than duplicating the query.
 *
 * Usage: npx tsx db/scripts/sweep-expired-attempts.ts
 */
import { pool } from "../shared/pool.js";
import { sweepExpiredAttempts } from "../assess/test/attempt/expiry.js";

async function main() {
  const result = await sweepExpiredAttempts();
  console.log(`found ${result.found} expired attempt(s) still open`);
  // Test-layer hardening C1: an expired attempt with zero saved responses is
  // now abandoned rather than force-scored — reported separately so a real
  // sweep run's output honestly distinguishes "closed as scored" from
  // "closed as never-answered", instead of collapsing both into "closed".
  console.log(
    `scored ${result.closed}, abandoned ${result.abandoned}, of ${result.found} attempt(s)${result.failed > 0 ? ` (${result.failed} failed — see errors above)` : ""}`
  );
  await pool.end();
}

main().catch((err) => {
  console.error("sweep-expired-attempts failed:", err);
  process.exitCode = 1;
});
