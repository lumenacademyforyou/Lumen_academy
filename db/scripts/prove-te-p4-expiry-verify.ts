import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { pool } from "../shared/pool.js";
import { enforceExpiry } from "../assess/test/attempt/expiry.js";
import { upsertResponse } from "../assess/test/attempt/attempt-flow.js";

// Second half of the TE-P4 expiry/sweeper proof — run only after the two
// attempts prove-te-p4-expiry-setup.ts created have genuinely passed their
// real 1-minute deadline (a real sleep, not a fabricated one).

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const STATE_PATH = path.resolve(SCRIPT_DIR, "..", "reports", "te-p4-expiry-proof-state.json");
const SWEEP_SCRIPT = path.resolve(SCRIPT_DIR, "sweep-expired-attempts.ts");

async function main() {
  const state: { testId: string; userId: string; attemptForEnforceId: string; attemptForSweeperId: string } = JSON.parse(
    fs.readFileSync(STATE_PATH, "utf-8")
  );
  const { userId, attemptForEnforceId, attemptForSweeperId } = state;

  // Part A — lazy enforcement (D-6): enforceExpiry force-submits a genuinely
  // expired attempt instead of returning null. (Re-running this script after
  // Part A already succeeded once is fine — enforceExpiry then correctly
  // returns null because the attempt is no longer in_progress/paused; that's
  // checked for below rather than treated as a failure.)
  const enforceResult = await enforceExpiry(attemptForEnforceId, userId);
  if (enforceResult) {
    console.log(`Part A PASS — enforceExpiry force-submitted ${attemptForEnforceId}: obtained ${enforceResult.obtainedMarks}/${enforceResult.totalMarks}`);
  } else {
    const already = await pool.query<{ attempt_state: string; submitted_reason: string | null }>(
      `select attempt_state, submitted_reason from assess.attempt where attempt_id = $1`,
      [attemptForEnforceId]
    );
    if (already.rows[0].attempt_state !== "scored" || already.rows[0].submitted_reason !== "expiry") {
      throw new Error(`enforceExpiry returned null and the attempt isn't already scored/expiry: ${JSON.stringify(already.rows[0])}`);
    }
    console.log(`Part A PASS (already run) — ${attemptForEnforceId} was already force-submitted by a prior run of this script.`);
  }

  const stateAfterEnforce = await pool.query<{ attempt_state: string; submitted_reason: string | null }>(
    `select attempt_state, submitted_reason from assess.attempt where attempt_id = $1`,
    [attemptForEnforceId]
  );
  if (stateAfterEnforce.rows[0].attempt_state !== "scored" || stateAfterEnforce.rows[0].submitted_reason !== "expiry") {
    throw new Error(`expected state=scored/reason=expiry, got ${JSON.stringify(stateAfterEnforce.rows[0])}`);
  }
  console.log("Part A PASS — attempt_state='scored', submitted_reason='expiry', both persisted correctly.");

  // Part B — the actual shipped sweeper script, run for real as a subprocess
  // (not a reimplementation of its query), against attemptForSweeperId which
  // was deliberately left untouched since setup so the sweeper is what finds
  // and closes it.
  console.log("\nrunning the real db/scripts/sweep-expired-attempts.ts as a subprocess...");
  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx"; // avoids execFileSync's shell:true (arg-escaping footgun) on Windows
  const sweepOutput = execFileSync(npxBin, ["tsx", SWEEP_SCRIPT], {
    cwd: path.resolve(SCRIPT_DIR, "..", ".."),
    encoding: "utf-8",
  });
  console.log(sweepOutput);
  if (!sweepOutput.includes(attemptForSweeperId)) {
    throw new Error(`sweeper output does not mention ${attemptForSweeperId} — it did not close the attempt we expected it to`);
  }

  const stateAfterSweep = await pool.query<{ attempt_state: string; submitted_reason: string | null }>(
    `select attempt_state, submitted_reason from assess.attempt where attempt_id = $1`,
    [attemptForSweeperId]
  );
  if (stateAfterSweep.rows[0].attempt_state !== "scored" || stateAfterSweep.rows[0].submitted_reason !== "sweeper") {
    throw new Error(`expected state=scored/reason=sweeper, got ${JSON.stringify(stateAfterSweep.rows[0])}`);
  }
  console.log("Part B PASS — the real sweeper script closed the untouched attempt with attempt_state='scored', submitted_reason='sweeper'.");

  // Part C — both closed attempts must now reject a further response with
  // the correct typed error (InvalidStateTransitionError -> the R-6-style
  // 4xx, not a raw 500), per the plan's own "done when" wording.
  const anyServedRes = await pool.query<{ question_id: string }>(
    `select question_id from assess.attempt_question where attempt_id = $1 limit 1`,
    [attemptForEnforceId]
  );
  const questionId = anyServedRes.rows[0].question_id;

  for (const [label, attemptId] of [
    ["enforceExpiry-closed", attemptForEnforceId],
    ["sweeper-closed", attemptForSweeperId],
  ] as const) {
    let rejectedCorrectly = false;
    try {
      await upsertResponse(attemptId, questionId, userId, { optionId: undefined, numericAnswer: undefined });
    } catch (err) {
      rejectedCorrectly = (err as Error).name === "InvalidStateTransitionError";
    }
    if (!rejectedCorrectly) throw new Error(`${label} attempt ${attemptId} did not reject a further response with InvalidStateTransitionError`);
    console.log(`Part C PASS (${label}) — a further response on ${attemptId} is rejected with InvalidStateTransitionError.`);
  }

  console.log("\nTE-P4 EXPIRY/SWEEPER GAP PASS — both proven against genuinely expired real attempts, no backdated data.");
  await pool.end();
}

main().catch((err) => {
  console.error("verify failed:", err);
  process.exitCode = 1;
});
