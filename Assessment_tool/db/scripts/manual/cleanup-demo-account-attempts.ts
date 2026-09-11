import { pool } from "../../shared/pool.js";
import { submitAttempt } from "../../assess/test/attempt/attempt-flow.js";

// The fixed demo account (frontend/src/services/demoSession.ts,
// demo.student@lumenacademy.dev) is shared across every manual/E2E check
// that logs in as "Demo Student" — Phase E's own verify-phase-e-session.ts
// and verify-phase-d-http-flow.ts included. Left-behind in_progress/paused
// attempts from those runs are exactly what Phase E's own reload-survival
// feature (App.tsx's getActiveSession effect) is designed to pick back up —
// which is correct for a real user, but pollutes this one shared account for
// later manual/E2E runs (found live while running Phase F6's Playwright
// journeys against it). Submits every stale attempt via the real state
// machine rather than deleting rows directly.
//
// Usage: npx tsx db/scripts/manual/cleanup-demo-account-attempts.ts

const DEMO_EMAIL = "demo.student@lumenacademy.dev";

async function main() {
  const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = $1`, [DEMO_EMAIL]);
  if (userRes.rowCount === 0) {
    console.log(`${DEMO_EMAIL} has no core.app_user row yet — nothing to clean up.`);
    return;
  }
  const userId = userRes.rows[0].user_id;

  const staleRes = await pool.query<{ attempt_id: string; attempt_state: string }>(
    `select attempt_id, attempt_state from assess.attempt where user_id = $1 and attempt_state in ('in_progress', 'paused')`,
    [userId]
  );
  console.log(`${staleRes.rowCount} stale attempt(s) for ${DEMO_EMAIL}`);

  for (const row of staleRes.rows) {
    try {
      if (row.attempt_state === "paused") {
        const { resumeAttempt } = await import("../../assess/test/attempt/attempt-flow.js");
        await resumeAttempt(row.attempt_id, userId);
      }
      const result = await submitAttempt(row.attempt_id, userId);
      console.log(`  submitted ${row.attempt_id} (was ${row.attempt_state}) -> scorecard ${result.scorecardId}, ${result.obtainedMarks}/${result.totalMarks}`);
    } catch (err) {
      console.log(`  failed to submit ${row.attempt_id}:`, err instanceof Error ? err.message : err);
    }
  }
}

main()
  .catch((err) => {
    console.error("cleanup-demo-account-attempts FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
