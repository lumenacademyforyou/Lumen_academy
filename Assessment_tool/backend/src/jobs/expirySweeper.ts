/**
 * Test-layer hardening C3 (docs/test-layer-hardening-prompt.md,
 * docs/BUGS.md#C3). The only expiry enforcement in this app used to be
 * lazy — enforceExpiry/reconcileUserAttempts (db/assess/test/attempt/expiry.ts)
 * only ever run when a request for that specific user happens to arrive.
 * db/scripts/sweep-expired-attempts.ts already had the right query for a
 * proper backstop, but nothing ever invoked it automatically — confirmed
 * live by grepping every *.json/*.yml/*.yaml in the repo for a reference to
 * it and finding none. A student who goes offline right at their deadline
 * and never reopens the app was left `in_progress` forever.
 *
 * This runs the same shared sweepExpiredAttempts() (expiry.ts) on a plain
 * setInterval inside the running API process — no new infrastructure
 * (queue, cron daemon) needed for a single-process deployment. If this app
 * is ever run as multiple server instances behind a load balancer, running
 * the same interval in every instance is still safe (submitAttempt is
 * idempotent per attempt, guarded by its own row lock — see attempt-flow.ts),
 * just mildly redundant; not worth a distributed-lock mechanism for a
 * background job this cheap and this idempotent.
 */
import { sweepExpiredAttempts } from "../../../db/assess/test/attempt/expiry.js";

// 60s: frequent enough that "auto-submits within the sweeper interval" (the
// prompt's own Definition-of-Done wording) means something close to
// real-time, cheap enough (one SELECT plus however many expired rows
// actually need closing, normally zero) to run indefinitely without ever
// being a meaningful load concern.
const SWEEP_INTERVAL_MS = 60_000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

async function runSweepOnce(): Promise<void> {
  try {
    const result = await sweepExpiredAttempts();
    if (result.found > 0) {
      console.log(
        `[expirySweeper] found ${result.found} expired attempt(s), scored ${result.closed}, abandoned ${result.abandoned}${result.failed > 0 ? `, ${result.failed} failed` : ""}`
      );
    }
  } catch (err) {
    // A single failed sweep tick must never crash the server or stop future
    // ticks — same "one bad row doesn't block the rest" discipline
    // reconcileUserAttempts already applies per-attempt, applied here at the
    // whole-sweep level.
    console.error("[expirySweeper] sweep tick failed:", err instanceof Error ? err.message : err);
  }
}

/** Idempotent — calling this twice without stopExpirySweeper() in between is a no-op, not a double interval. */
export function startExpirySweeper(): void {
  if (intervalHandle) return;
  intervalHandle = setInterval(runSweepOnce, SWEEP_INTERVAL_MS);
  // Fire once immediately on boot rather than waiting a full interval for
  // the first pass — a server restart shouldn't add up to a minute of extra
  // delay before a backlog accumulated while it was down gets swept.
  void runSweepOnce();
}

export function stopExpirySweeper(): void {
  if (!intervalHandle) return;
  clearInterval(intervalHandle);
  intervalHandle = null;
}
