// verify-phase-g-analytics.ts
// LA-APP-COMPLETION-001 Phase G — read-only sanity check of the new
// getDashboardAnalytics() aggregation (db/assess/analytics/dashboard.ts)
// against the real, already-scored demo-account attempts left over from
// prior sessions' e2e/manual runs. Does not mutate anything; safe to
// re-run. Requires DATABASE_URL to point at a database with at least one
// scored assess.attempt for the demo account (Phase D/E/F's manual scripts
// all created several).

import "dotenv/config";
import { pool } from "../../shared/pool.js";
import { getDashboardAnalytics } from "../../assess/analytics/dashboard.js";

const DEMO_EMAIL = "demo.student@lumenacademy.dev";

async function main() {
  const userRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = $1`, [DEMO_EMAIL]);
  if (userRes.rowCount === 0) {
    throw new Error(`no core.app_user row for ${DEMO_EMAIL} — run a prior Phase D/E/F manual script first to create one`);
  }
  const userId = userRes.rows[0].user_id;

  const scoredCountRes = await pool.query<{ n: string }>(
    `select count(*) as n from assess.attempt where user_id = $1 and attempt_state = 'scored'`,
    [userId]
  );
  console.log(`demo account scored attempts: ${scoredCountRes.rows[0].n}`);

  const analytics = await getDashboardAnalytics(userId);

  console.log("\n--- attemptHistory ---");
  console.table(analytics.attemptHistory.map((a) => ({ mode: a.mode, testCode: a.testCode, obtained: a.obtainedMarks, total: a.totalMarks, accuracy: a.accuracyPercent })));

  console.log("\n--- scoreTrend (chronological) ---");
  console.table(analytics.scoreTrend.map((p) => ({ submittedAt: p.submittedAt, accuracy: p.accuracyPercent })));

  console.log("\n--- subjectAccuracy ---");
  console.table(analytics.subjectAccuracy);

  console.log("\n--- unitAccuracy (first 10) ---");
  console.table(analytics.unitAccuracy.slice(0, 10));

  console.log("\n--- difficultyAccuracy ---");
  console.table(analytics.difficultyAccuracy);

  console.log("\n--- timeDistribution ---");
  console.table(analytics.timeDistribution);

  console.log("\n--- weakestUnits ---");
  console.table(analytics.weakestUnits);

  console.log("\n--- unattemptedRate ---");
  console.log(analytics.unattemptedRate);

  // Cross-checks: every count(*) group in subjectAccuracy/unitAccuracy/
  // difficultyAccuracy must sum to the same served total (the same
  // attempt_question rows, just grouped differently) — a real internal
  // consistency check, not just "did it not throw."
  const subjectTotal = analytics.subjectAccuracy.reduce((sum, s) => sum + s.total, 0);
  const unitTotal = analytics.unitAccuracy.reduce((sum, u) => sum + u.total, 0);
  const difficultyTotal = analytics.difficultyAccuracy.reduce((sum, d) => sum + d.total, 0);
  console.log(`\nserved totals — subject: ${subjectTotal}, unit: ${unitTotal}, difficulty: ${difficultyTotal}, unattemptedRate.servedCount: ${analytics.unattemptedRate.servedCount}`);
  const allEqual = subjectTotal === unitTotal && unitTotal === difficultyTotal && difficultyTotal === analytics.unattemptedRate.servedCount;
  console.log(allEqual ? "OK: all four served-question totals agree." : "MISMATCH: served totals disagree across groupings.");

  await pool.end();
  process.exit(allEqual ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
