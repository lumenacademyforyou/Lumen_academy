import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// LA-APP-COMPLETION-001 Phase G — HTTP-level smoke test of the two new
// endpoints the rebuilt Dashboard/Analytics/StudyPlan views actually call:
// GET /analytics/dashboard (analyticsApi.ts's getDashboardAnalytics) and
// GET /assess/attempts/:id/review (sessionApi.ts's getAttemptReview, wired
// for the first time in this phase). Confirms the real response shapes
// match what the frontend types expect, through the real HTTP surface (not
// just direct DB calls) — same demo account and pattern as
// verify-phase-d-http-flow.ts. Run against a live server on :4000.

const BASE = "http://localhost:4000/api";
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  const token = data.session.access_token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("signed in as demo account");

  // Unauthenticated request must still be rejected (analytics is per-user data).
  const noAuthRes = await fetch(`${BASE}/analytics/dashboard`);
  console.log(`GET /analytics/dashboard (no auth) -> ${noAuthRes.status} (expect 401)`);
  if (noAuthRes.status !== 401) throw new Error("analytics/dashboard is not auth-gated");

  const dashRes = await fetch(`${BASE}/analytics/dashboard`, { headers });
  const dashBody = await dashRes.json();
  if (dashRes.status !== 200) throw new Error(`analytics/dashboard failed: ${JSON.stringify(dashBody)}`);
  const a = dashBody.data;
  console.log(`GET /analytics/dashboard -> 200`);
  console.log(`  attemptHistory: ${a.attemptHistory.length} rows`);
  console.log(`  scoreTrend: ${a.scoreTrend.length} points`);
  console.log(`  subjectAccuracy: ${a.subjectAccuracy.map((s: any) => `${s.subjectCode}=${s.accuracyPercent}%`).join(", ")}`);
  console.log(`  unitAccuracy: ${a.unitAccuracy.length} units`);
  console.log(`  difficultyAccuracy: ${a.difficultyAccuracy.map((d: any) => d.difficultyBand).join(", ")}`);
  console.log(`  timeDistribution: ${a.timeDistribution.length} buckets`);
  console.log(`  weakestUnits: ${a.weakestUnits.length}`);
  console.log(`  unattemptedRate: ${JSON.stringify(a.unattemptedRate)}`);

  const requiredArrayFields = ["attemptHistory", "scoreTrend", "subjectAccuracy", "unitAccuracy", "difficultyAccuracy", "timeDistribution", "weakestUnits"];
  for (const f of requiredArrayFields) {
    if (!Array.isArray(a[f])) throw new Error(`analytics.${f} is not an array`);
  }
  if (typeof a.unattemptedRate?.unattemptedPercent !== "number") throw new Error("unattemptedRate.unattemptedPercent missing/wrong type");

  if (a.attemptHistory.length === 0) {
    console.log("\nNo scored attempts for the demo account — cannot exercise the review endpoint. Run a prior Phase C/D/E manual script to create one, then re-run this check.");
    process.exit(0);
  }

  const attemptId = a.attemptHistory[0].attemptId;
  const reviewRes = await fetch(`${BASE}/assess/attempts/${attemptId}/review`, { headers });
  const reviewBody = await reviewRes.json();
  if (reviewRes.status !== 200) throw new Error(`review failed: ${JSON.stringify(reviewBody)}`);
  const review = reviewBody.data;
  console.log(`\nGET /assess/attempts/${attemptId}/review -> 200, ${review.length} questions`);
  const correct = review.filter((q: any) => q.isCorrect === true).length;
  const incorrect = review.filter((q: any) => q.isCorrect === false).length;
  const unattempted = review.filter((q: any) => q.isCorrect === null).length;
  console.log(`  correct=${correct} incorrect=${incorrect} unattempted=${unattempted} (sum=${correct + incorrect + unattempted}, total=${review.length})`);
  if (correct + incorrect + unattempted !== review.length) throw new Error("review filter counts don't sum to total questions");

  if (review.length > 0) {
    const q = review[0];
    for (const f of ["questionId", "stemText", "options", "images", "isCorrect", "topicTitle"]) {
      if (!(f in q)) throw new Error(`review question missing field: ${f}`);
    }
  }

  console.log("\nPhase G HTTP flow: PASS");
}

main().catch((err) => {
  console.error("verify-phase-g-http-flow FAILED:", err);
  process.exitCode = 1;
});
