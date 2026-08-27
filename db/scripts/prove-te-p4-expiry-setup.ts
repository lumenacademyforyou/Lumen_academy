import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../shared/pool.js";
import { startAttempt } from "../assess/test/attempt/attempt-flow.js";

// TE-P4 outstanding gap (LA-PLAN-002 Day 2, Santhosh 12:30-13:00) — proving
// enforceExpiry + the sweeper against a GENUINELY expired attempt, which
// TE-P4's own build log flagged as unproven: "there wasn't a fast, honest
// way to produce one without either fabricating a backdated server_deadline
// (borderline R-5 territory) or waiting out a real test duration."
//
// This script resolves that without fabricating anything: it temporarily
// sets the real NEET_E2E_FIXTURE test's duration_minutes to 1 minute, starts
// two real attempts (so server_deadline = a genuine now()+1min, computed by
// startAttempt itself, not backdated), then immediately restores the test's
// real duration_minutes so no other attempt is affected. The two attempts
// then have to actually wait out their real 60-90 seconds — see
// prove-te-p4-expiry-verify.ts, run after a real sleep.

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.resolve(SCRIPT_DIR, "..", "reports", "te-p4-expiry-proof-state.json");

async function main() {
  const testRes = await pool.query<{ test_id: string; duration_minutes: number }>(
    `select test_id, duration_minutes from assess.test where test_status = 'published' limit 1`
  );
  if (testRes.rowCount === 0) throw new Error("no published test to test against");
  const { test_id: testId, duration_minutes: originalDuration } = testRes.rows[0];

  const userRes = await pool.query<{ user_id: string }>(
    `select user_id from core.app_user where email = 'student@lumen.internal'`
  );
  if (userRes.rowCount === 0) throw new Error("fixture student@lumen.internal not found");
  const userId = userRes.rows[0].user_id;

  console.log(`test ${testId}, real duration_minutes=${originalDuration} — temporarily setting to 1 to get a real short-lived deadline`);
  await pool.query(`update assess.test set duration_minutes = 1 where test_id = $1`, [testId]);

  const attemptForEnforce = await startAttempt(testId, userId);
  const attemptForSweeper = await startAttempt(testId, userId);

  await pool.query(`update assess.test set duration_minutes = $1 where test_id = $2`, [originalDuration, testId]);
  console.log(`restored duration_minutes to ${originalDuration} — no other attempt on this test is affected`);

  console.log(`attempt for enforceExpiry: ${attemptForEnforce.attemptId} (deadline ${attemptForEnforce.serverDeadline})`);
  console.log(`attempt for sweeper:       ${attemptForSweeper.attemptId} (deadline ${attemptForSweeper.serverDeadline})`);

  fs.writeFileSync(
    STATE_PATH,
    JSON.stringify(
      { testId, userId, attemptForEnforceId: attemptForEnforce.attemptId, attemptForSweeperId: attemptForSweeper.attemptId },
      null,
      2
    )
  );
  console.log(`wrote ${STATE_PATH} — now wait ~70 real seconds before running prove-te-p4-expiry-verify.ts`);
  await pool.end();
}

main().catch((err) => {
  console.error("setup failed:", err);
  process.exitCode = 1;
});
