import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";

// Test-layer hardening B8 (docs/test-layer-hardening-prompt.md,
// docs/BUGS.md#B8). Live HTTP proof that the new attempt-lockdown middleware
// (backend/src/middleware/attemptLockdown.ts, folded into requireAuth.ts)
// actually rejects a non-attempt API call while the demo account has an
// in_progress attempt, allows the attempt's own endpoints through, and lifts
// the lockdown once submitted — same real-server-and-real-token convention
// as verify-phase-d-http-flow.ts, run against `npm run dev:api`, not a mock.

const BASE = "http://localhost:4000/api";
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let { data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error?.message === "Email not confirmed") {
    const admin = getSupabaseAdmin();
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const user = list.users.find((u: { email?: string }) => u.email === DEMO_EMAIL);
    if (!user) throw new Error("demo user not found via admin listUsers despite signInWithPassword finding it");
    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (updateErr) throw updateErr;
    ({ data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD }));
  }
  if (error) throw error;
  if (!data.session) throw new Error("no session returned from sign-in");
  const token = data.session.access_token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("signed in as demo account");

  // Real reset, same call the frontend makes right after login (BUG-02) —
  // guarantees no leftover active attempt from a previous manual run.
  const resetRes = await fetch(`${BASE}/auth/demo/reset`, { method: "POST", headers });
  console.log(`POST /auth/demo/reset -> ${resetRes.status}`);

  const dashboardBefore = await fetch(`${BASE}/analytics/dashboard`, { headers });
  console.log(`GET /analytics/dashboard (no active attempt) -> ${dashboardBefore.status} (expect 200)`);
  if (dashboardBefore.status !== 200) throw new Error("FAIL: dashboard should be reachable with no active attempt");

  const treeRes = await fetch(`${BASE}/catalog/tree`);
  const tree = await treeRes.json();
  const physics = tree.data.subjects.find((s: any) => s.subjectCode === "PHY");

  const sessionRes = await fetch(`${BASE}/assess/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "subject-wise", title: "B8 lockdown verification", durationMinutes: 10, subjectId: physics.subjectId, pickCount: 5 }),
  });
  const sessionBody = await sessionRes.json();
  if (sessionRes.status !== 201) throw new Error(`session creation failed: ${JSON.stringify(sessionBody)}`);
  const session = sessionBody.data;
  console.log(`POST /assess/sessions -> ${sessionRes.status}, attemptId=${session.attemptId}`);

  const dashboardDuring = await fetch(`${BASE}/analytics/dashboard`, { headers });
  const dashboardDuringBody = await dashboardDuring.json();
  console.log(`GET /analytics/dashboard (attempt in_progress) -> ${dashboardDuring.status} (expect 423), code=${dashboardDuringBody?.error?.code ?? dashboardDuringBody?.code}`);
  if (dashboardDuring.status !== 423) throw new Error("FAIL: dashboard should be locked down during an active attempt");

  const catalogDuring = await fetch(`${BASE}/catalog/tree`, { headers });
  console.log(`GET /catalog/tree (public, no auth header needed but sent anyway) -> ${catalogDuring.status} (informational only — public route)`);

  const envelopeDuring = await fetch(`${BASE}/assess/attempts/${session.attemptId}/envelope`, { headers });
  console.log(`GET /assess/attempts/:id/envelope (attempt in_progress) -> ${envelopeDuring.status} (expect 200 — allowlisted)`);
  if (envelopeDuring.status !== 200) throw new Error("FAIL: the attempt's own envelope endpoint must remain reachable during lockdown");

  const meDuring = await fetch(`${BASE}/me`, { headers });
  console.log(`GET /me (attempt in_progress) -> ${meDuring.status} (expect 423 — not allowlisted)`);
  if (meDuring.status !== 423) throw new Error("FAIL: /me should be locked down too (only /assess/attempts/*, /auth/session/*, /health are allowlisted)");

  const submitRes = await fetch(`${BASE}/assess/attempts/${session.attemptId}/submit`, { method: "POST", headers, body: "{}" });
  console.log(`POST /assess/attempts/:id/submit -> ${submitRes.status} (expect 200)`);
  if (submitRes.status !== 200) throw new Error("FAIL: submit itself must stay reachable during lockdown");

  const dashboardAfter = await fetch(`${BASE}/analytics/dashboard`, { headers });
  console.log(`GET /analytics/dashboard (attempt scored) -> ${dashboardAfter.status} (expect 200 — lockdown lifted)`);
  if (dashboardAfter.status !== 200) throw new Error("FAIL: dashboard should be reachable again once the attempt is no longer in_progress");

  console.log("\nB8 attempt-lockdown live HTTP verification: PASS");
}

main().catch((err) => {
  console.error("verify-b8-attempt-lockdown FAILED:", err);
  process.exitCode = 1;
});
