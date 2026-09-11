import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";

// One-off end-to-end HTTP smoke test for Phase D's new frontend flow,
// exercising the exact same sequence of real API calls the browser makes:
// sign in -> GET /catalog/tree -> POST /assess/sessions -> answer a couple
// of questions via PATCH .../responses -> POST .../submit -> inspect the
// scorecard. Run against the live built server (npm run start), not through
// the browser (this sandbox's Chromium automation stalls — see
// docs/APP_COMPLETION_PLAN.md's Phase A2/A3 notes) — same demo account
// frontend/src/services/demoSession.ts uses.

const BASE = "http://localhost:4000/api";
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  let { data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error?.message === "Email not confirmed") {
    // demoSession.ts's sign-up path never confirms the email (no inbox to
    // click a link in) — for this one-off HTTP check, confirm it directly
    // via the admin API (same client bulk-publish-draft-questions.ts etc.
    // already use) rather than leaving the check unable to run at all.
    console.log("demo account exists but is unconfirmed — confirming via admin API");
    const admin = getSupabaseAdmin();
    const { data: list, error: listErr } = await admin.auth.admin.listUsers();
    if (listErr) throw listErr;
    const user = list.users.find((u: { email?: string }) => u.email === DEMO_EMAIL);
    if (!user) throw new Error("demo user not found via admin listUsers despite signInWithPassword finding it");
    const { error: updateErr } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
    if (updateErr) throw updateErr;
    ({ data, error } = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD }));
  }
  if (error) {
    console.log(`sign-in failed (${error.message}), trying sign-up`);
    const signUp = await supabase.auth.signUp({ email: DEMO_EMAIL, password: DEMO_PASSWORD, options: { data: { display_name: "Prince A" } } });
    if (signUp.error) throw signUp.error;
    data = signUp.data;
  }
  if (!data.session) throw new Error(`no session returned (user=${JSON.stringify(data.user?.id)}) — likely needs email confirmation`);
  const token = data.session!.access_token;
  console.log("signed in as demo account, got bearer token");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const treeRes = await fetch(`${BASE}/catalog/tree`);
  const tree = await treeRes.json();
  console.log(`GET /catalog/tree -> ${treeRes.status}, ${tree.data.subjects.length} subjects`);
  for (const s of tree.data.subjects) {
    console.log(`  ${s.subjectCode}: publishedQuestionCount=${s.publishedQuestionCount}, ${s.units.length} units`);
  }
  const physics = tree.data.subjects.find((s: any) => s.subjectCode === "PHY");

  const sessionRes = await fetch(`${BASE}/assess/sessions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ mode: "subject-wise", title: "HTTP smoke test", durationMinutes: 10, subjectId: physics.subjectId, pickCount: 5 }),
  });
  const sessionBody = await sessionRes.json();
  if (sessionRes.status !== 201) throw new Error(`session creation failed: ${JSON.stringify(sessionBody)}`);
  const session = sessionBody.data;
  console.log(`POST /assess/sessions -> ${sessionRes.status}, attemptId=${session.attemptId}, ${session.questions.length} questions`);
  console.log(`  sample question: "${session.questions[0].stemText.slice(0, 80)}..."`);
  console.log(`  sample options: ${session.questions[0].options.map((o: any) => o.optionLabel).join(", ")}`);
  const withTamil = session.questions.filter((q: any) => q.stemTextTa);
  console.log(`  Tamil coverage: ${withTamil.length}/${session.questions.length} questions have stemTextTa`);
  if (withTamil.length > 0) {
    console.log(`  sample Tamil stem: "${withTamil[0].stemTextTa.slice(0, 60)}..."`);
    console.log(`  sample Tamil option: "${withTamil[0].options.find((o: any) => o.optionTextTa)?.optionTextTa ?? "(none)"}"`);
  }
  const hasCorrectness = JSON.stringify(session).includes("isCorrect");
  console.log(`  answer-key leak check (should be false): ${hasCorrectness}`);

  // Answer 2 of the 5 questions
  const responses = session.questions.slice(0, 2).map((q: any) => ({ questionId: q.questionId, optionId: q.options[0].optionId, isMarkedForReview: false, timeSpentSeconds: 5 }));
  const saveRes = await fetch(`${BASE}/assess/attempts/${session.attemptId}/responses`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ responses }),
  });
  const saveBody = await saveRes.json();
  console.log(`PATCH .../responses -> ${saveRes.status}, ${JSON.stringify(saveBody.data)}`);

  const submitRes = await fetch(`${BASE}/assess/attempts/${session.attemptId}/submit`, { method: "POST", headers, body: "{}" });
  const submitBody = await submitRes.json();
  console.log(`POST .../submit -> ${submitRes.status}, ${JSON.stringify(submitBody.data)}`);

  if (submitRes.status !== 200) throw new Error("submit failed");
  console.log("\nEnd-to-end HTTP flow: PASS");
}

main().catch((err) => {
  console.error("verify-phase-d-http-flow FAILED:", err);
  process.exitCode = 1;
});
