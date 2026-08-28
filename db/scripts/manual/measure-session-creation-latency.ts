// measure-session-creation-latency.ts
// LA-APP-COMPLETION-001 Phase H follow-up — re-measures POST /assess/sessions
// (full-mock, ~180 questions) latency after batching assess.attempt_question's
// per-question inserts into one unnest()-based bulk insert
// (db/assess/test/attempt/attempt-flow.ts's startAttempt). Phase F measured
// ~14s here with the old one-row-per-await loop; this checks the real
// improvement against the same live remote database. Requires a running
// server on :4000 (npm run dev:api or npm start).

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BASE = "http://localhost:4000/api";
const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";

async function main() {
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
  const { data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  const headers = { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" };

  const t0 = Date.now();
  const res = await fetch(`${BASE}/assess/sessions`, { method: "POST", headers, body: JSON.stringify({ mode: "full-mock", title: "Perf timing check" }) });
  const body = await res.json();
  const ms = Date.now() - t0;
  if (res.status !== 201) throw new Error(`session creation failed (${res.status}): ${JSON.stringify(body)}`);
  console.log(`POST /assess/sessions (full-mock) -> ${res.status}, ${body.data.questions.length} questions, ${ms}ms`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
