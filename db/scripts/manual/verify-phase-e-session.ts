import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../../shared/pool.js";

// One-off end-to-end verification for Phase E (session management + auto
// logout) — LA-APP-COMPLETION-001. Exercises the real HTTP surface
// (backend/src/services/session.service.ts + authSessionController.ts)
// against the actual built-and-started server (npm run start), same demo
// account convention as verify-phase-d-http-flow.ts. Backdates the DB row
// directly to simulate idle/absolute expiry without waiting 30 minutes/12
// hours for real — that's the only part that touches the DB directly rather
// than going through HTTP.

const BASE = "http://localhost:4000/api";
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message ?? "no session"} — run verify-phase-d-http-flow.ts first if the demo account doesn't exist yet`);
  const token = data.session.access_token;
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  console.log("signed in as demo account");

  // 1. First authenticated call lazily creates the core.user_session row.
  const meRes = await fetch(`${BASE}/me`, { headers });
  if (meRes.status !== 200) throw new Error(`GET /me -> ${meRes.status}, expected 200 (lazy session creation)`);
  console.log("GET /me -> 200 (session row created)");

  // 2. GET /auth/session returns a sane status snapshot.
  const statusRes = await fetch(`${BASE}/auth/session`, { headers });
  const status = (await statusRes.json()).data;
  console.log(`GET /auth/session -> ${statusRes.status}, sessionId=${status.sessionId}, idleTimeoutMs=${status.idleTimeoutMs}`);
  if (statusRes.status !== 200 || !status.sessionId) throw new Error("GET /auth/session did not return a session snapshot");
  if (status.idleTimeoutMs !== 30 * 60 * 1000) throw new Error(`expected default 30-min idle timeout, got ${status.idleTimeoutMs}ms`);

  // 3. Polling status must NOT touch last_activity_at (only heartbeat does).
  // node-postgres returns timestamptz columns as Date objects — compare by
  // value (getTime()), not by reference.
  const lastActivityMs = async () =>
    (await pool.query<{ last_activity_at: Date }>(`select last_activity_at from core.user_session where session_id = $1`, [status.sessionId])).rows[0].last_activity_at.getTime();
  const before = await lastActivityMs();
  await new Promise((r) => setTimeout(r, 1100));
  await fetch(`${BASE}/auth/session`, { headers });
  const afterPoll = await lastActivityMs();
  const pollTouched = before !== afterPoll;
  console.log(`status poll touched last_activity_at (should be false): ${pollTouched}`);
  if (pollTouched) throw new Error("GET /auth/session must not extend the idle timer");

  // 4. Heartbeat DOES touch it.
  const heartbeatRes = await fetch(`${BASE}/auth/session/heartbeat`, { method: "POST", headers });
  const afterHeartbeat = await lastActivityMs();
  const heartbeatTouched = afterPoll !== afterHeartbeat;
  console.log(`POST /auth/session/heartbeat -> ${heartbeatRes.status}, touched last_activity_at: ${heartbeatTouched}`);
  if (heartbeatRes.status !== 204 || !heartbeatTouched) throw new Error("heartbeat must update last_activity_at");

  // 5. Backdate last_activity_at past the idle window -> next request must
  // be rejected with 401 SESSION_EXPIRED, and the row must be marked revoked
  // server-side (E3: "an expired token must be rejected by the API, not
  // merely hidden by the UI").
  await pool.query(`update core.user_session set last_activity_at = now() - interval '31 minutes' where session_id = $1`, [status.sessionId]);
  const idleRejectRes = await fetch(`${BASE}/me`, { headers });
  const idleRejectBody = await idleRejectRes.json();
  console.log(`GET /me after backdating idle -> ${idleRejectRes.status}, code=${idleRejectBody?.error?.code}`);
  if (idleRejectRes.status !== 401 || idleRejectBody?.error?.code !== "SESSION_EXPIRED") throw new Error("expected 401 SESSION_EXPIRED after idle timeout");
  const revokedRow = await pool.query<{ revoked_at: string | null; revoked_reason: string | null }>(`select revoked_at, revoked_reason from core.user_session where session_id = $1`, [status.sessionId]);
  console.log(`row after idle rejection: revoked_at=${revokedRow.rows[0].revoked_at}, revoked_reason=${revokedRow.rows[0].revoked_reason}`);
  if (!revokedRow.rows[0].revoked_at || revokedRow.rows[0].revoked_reason !== "idle_timeout") throw new Error("row was not marked revoked/idle_timeout server-side");

  // 6. Once revoked, it STAYS revoked on a subsequent call with the same
  // (still Supabase-valid) token — it must not silently reset itself.
  const stillRejectedRes = await fetch(`${BASE}/me`, { headers });
  console.log(`GET /me again (same token, already revoked) -> ${stillRejectedRes.status} (should stay 401)`);
  if (stillRejectedRes.status !== 401) throw new Error("a revoked session must stay revoked, not silently reset on the next request");

  // 7. A fresh sign-in (new Supabase session_id) is unaffected by the old
  // session's revocation — proves revocation is scoped to that one login,
  // not the user as a whole.
  const { data: freshData, error: freshErr } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (freshErr || !freshData.session) throw new Error("re-sign-in failed");
  const freshHeaders = { Authorization: `Bearer ${freshData.session.access_token}`, "Content-Type": "application/json" };
  const freshRes = await fetch(`${BASE}/me`, { headers: freshHeaders });
  console.log(`GET /me with a fresh sign-in -> ${freshRes.status} (should be 200, unaffected by the old session's revocation)`);
  if (freshRes.status !== 200) throw new Error("a fresh sign-in must not be blocked by a different (revoked) session");

  // 8. E4 — pause/resume + envelope reload-survival, exercised through the
  // real HTTP surface the rebuilt frontend uses (sessionApi.ts's
  // getActiveSession). Uses the still-valid fresh sign-in from step 7.
  const treeRes = await fetch(`${BASE}/catalog/tree`);
  const tree = (await treeRes.json()).data;
  const subject = tree.subjects[0];
  const createRes = await fetch(`${BASE}/assess/sessions`, {
    method: "POST",
    headers: freshHeaders,
    body: JSON.stringify({ mode: "subject-wise", title: "Phase E pause/resume check", durationMinutes: 10, subjectId: subject.subjectId, pickCount: 5 }),
  });
  const created = (await createRes.json()).data;
  console.log(`POST /assess/sessions -> ${createRes.status}, attemptId=${created.attemptId}, testCode=${created.testCode}, mode=${created.mode}`);
  if (createRes.status !== 201 || !created.testCode || !created.mode) throw new Error("session creation must return testCode and mode");

  const listBeforePause = (await (await fetch(`${BASE}/assess/attempts`, { headers: freshHeaders })).json()).data;
  const attemptBeforePause = listBeforePause.find((a: any) => a.attemptId === created.attemptId);
  console.log(`GET /assess/attempts -> attemptState=${attemptBeforePause?.attemptState} (should be in_progress)`);
  if (attemptBeforePause?.attemptState !== "in_progress") throw new Error("freshly-started attempt should be in_progress");

  const pauseRes = await fetch(`${BASE}/assess/attempts/${created.attemptId}/pause`, { method: "POST", headers: freshHeaders });
  console.log(`POST .../pause -> ${pauseRes.status}`);
  if (pauseRes.status !== 204) throw new Error("pause failed");

  const listAfterPause = (await (await fetch(`${BASE}/assess/attempts`, { headers: freshHeaders })).json()).data;
  const attemptAfterPause = listAfterPause.find((a: any) => a.attemptId === created.attemptId);
  console.log(`GET /assess/attempts after pause -> attemptState=${attemptAfterPause?.attemptState} (should be paused)`);
  if (attemptAfterPause?.attemptState !== "paused") throw new Error("attempt should be paused");

  const envelopeWhilePaused = (await (await fetch(`${BASE}/assess/attempts/${created.attemptId}/envelope`, { headers: freshHeaders })).json()).data;
  console.log(`GET .../envelope while paused -> status=${envelopeWhilePaused.status}, remainingSeconds=${envelopeWhilePaused.remainingSeconds}, testCode=${envelopeWhilePaused.testCode}, mode=${envelopeWhilePaused.mode}`);
  if (envelopeWhilePaused.status !== "paused" || !envelopeWhilePaused.testCode || !envelopeWhilePaused.mode) throw new Error("envelope must carry testCode/mode on every call, not just at session-creation time");

  const resumeRes = await fetch(`${BASE}/assess/attempts/${created.attemptId}/resume`, { method: "POST", headers: freshHeaders });
  console.log(`POST .../resume -> ${resumeRes.status}`);
  if (resumeRes.status !== 204) throw new Error("resume failed");

  const envelopeAfterResume = (await (await fetch(`${BASE}/assess/attempts/${created.attemptId}/envelope`, { headers: freshHeaders })).json()).data;
  console.log(`GET .../envelope after resume -> status=${envelopeAfterResume.status}, remainingSeconds=${envelopeAfterResume.remainingSeconds}`);
  if (envelopeAfterResume.status !== "in_progress") throw new Error("attempt should be in_progress again after resume");

  // 9. Explicit logout revokes immediately.
  const freshStatusRes = await fetch(`${BASE}/auth/session`, { headers: freshHeaders });
  const freshSessionId = (await freshStatusRes.json()).data.sessionId;
  const logoutRes = await fetch(`${BASE}/auth/session/logout`, { method: "POST", headers: freshHeaders, body: JSON.stringify({ reason: "user_logout" }) });
  console.log(`POST /auth/session/logout -> ${logoutRes.status}`);
  const afterLogoutRes = await fetch(`${BASE}/me`, { headers: freshHeaders });
  console.log(`GET /me after logout -> ${afterLogoutRes.status} (should be 401)`);
  if (afterLogoutRes.status !== 401) throw new Error("expected 401 immediately after explicit logout");
  const loggedOutRow = await pool.query<{ revoked_reason: string | null }>(`select revoked_reason from core.user_session where session_id = $1`, [freshSessionId]);
  if (loggedOutRow.rows[0].revoked_reason !== "user_logout") throw new Error("expected revoked_reason='user_logout'");

  console.log("\nPhase E session-management HTTP flow: PASS");
}

main()
  .catch((err) => {
    console.error("verify-phase-e-session FAILED:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
