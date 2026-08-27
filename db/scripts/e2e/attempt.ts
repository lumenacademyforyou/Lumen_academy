import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../../../backend/src/lib/supabaseAdmin.js";
import { pool } from "../../shared/pool.js";

// STAGE 6 — end-to-end attempt proof against the LIVE server (must be
// running: npx tsx watch backend/server.ts). Uses the real
// NEET_E2E_FIXTURE test from 03_assess_fixture.ts (20 real, migrated
// questions) and a real test-student account, created here via the Auth
// Admin API (not raw SQL) if it doesn't already exist.
//
// "Request a paper" (step 2) reads test_question + question_option directly
// from the DB, not through an HTTP endpoint — GET /attempts/:id/paper
// (LA-ARC-005's assembled-paper endpoint) hasn't been built yet. Flagging
// that gap rather than quietly building a whole new endpoint inside an e2e
// script. Steps 3 onward all go through the real HTTP API.
//
// Usage: npx tsx db/scripts/e2e/attempt.ts

const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000/api";
const TEST_STUDENT_EMAIL = "e2e-test-student@lumen.internal";
const TEST_STUDENT_PASSWORD = "E2E-test-password-" + Math.random().toString(36).slice(2); // reset each run if user pre-exists is fine, we always ensure via admin API

async function ensureTestStudent(): Promise<{ email: string; password: string }> {
  const admin = getSupabaseAdmin();
  const list = await admin.auth.admin.listUsers();
  if (list.error) throw new Error(`listUsers failed: ${list.error.message}`);
  const users = list.data.users as { id: string; email?: string }[];
  const existing = users.find((u) => u.email === TEST_STUDENT_EMAIL);

  const password = TEST_STUDENT_PASSWORD;
  if (existing) {
    // reset password so this run's sign-in is deterministic regardless of prior runs
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) throw new Error(`failed to reset test student password: ${error.message}`);
    console.log(`1. test student exists -> ${existing.id} (password reset for this run)`);
    return { email: TEST_STUDENT_EMAIL, password };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email: TEST_STUDENT_EMAIL,
    password,
    email_confirm: true,
    user_metadata: { purpose: "e2e_test_student" },
  });
  if (error || !created.user) throw new Error(`failed to create test student: ${error?.message}`);
  console.log(`1. created test student -> ${created.user.id}`);
  return { email: TEST_STUDENT_EMAIL, password };
}

interface GroundTruthQuestion {
  test_question_id: string;
  question_id: string;
  correct_option_id: string;
}

async function loadFixturePaper(): Promise<{ testId: string; questions: GroundTruthQuestion[] }> {
  const testRes = await pool.query<{ test_id: string }>(`select test_id from assess.test where test_code = 'NEET_E2E_FIXTURE'`);
  if (testRes.rowCount === 0) throw new Error("NEET_E2E_FIXTURE not found — run db/scripts/seed/03_assess_fixture.ts first");
  const testId = testRes.rows[0].test_id;

  const rows = await pool.query<GroundTruthQuestion>(
    `select tq.test_question_id, tq.question_id, qo.option_id as correct_option_id
       from assess.test_question tq
       join assess.test_section ts on ts.test_section_id = tq.test_section_id
       join content.question_option qo on qo.question_id = tq.question_id and qo.is_correct = true
      where ts.test_id = $1
      order by tq.sequence_no`,
    [testId]
  );
  return { testId, questions: rows.rows };
}

async function main() {
  const { email, password } = await ensureTestStudent();

  const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!);
  const signIn = await anon.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) throw new Error(`sign-in failed: ${signIn.error?.message}`);
  const token = signIn.data.session.access_token;
  console.log("1b. authenticated, got access token");

  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`);
    return json;
  }

  console.log("2. loading fixture paper (direct DB read — no paper-assembly endpoint built yet)");
  const { testId, questions } = await loadFixturePaper();
  console.log(`   test_id=${testId}, ${questions.length} questions`);

  console.log("3. POST /assess/attempts/start");
  const startRes = await call("POST", "/assess/attempts/start", { test_id: testId });
  const attemptId = startRes.data.attempt_id;
  console.log(`   attempt_id=${attemptId}`);

  // mix: first 12 correct, next 5 wrong, last 3 left unanswered
  const CORRECT_COUNT = 12;
  const WRONG_COUNT = 5;
  let expectedMarks = 0;
  let expectedCorrect = 0;
  let expectedWrong = 0;
  let expectedSkipped = 0;

  console.log("4. submitting responses (mix of correct / wrong / unanswered)");
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (i < CORRECT_COUNT) {
      await call("PATCH", `/assess/attempts/${attemptId}/responses/${q.test_question_id}`, { option_id: q.correct_option_id });
      expectedMarks += 4;
      expectedCorrect++;
    } else if (i < CORRECT_COUNT + WRONG_COUNT) {
      // pick any option that is not the correct one
      const wrongRes = await pool.query<{ option_id: string }>(
        `select option_id from content.question_option where question_id = $1 and is_correct = false limit 1`,
        [q.question_id]
      );
      await call("PATCH", `/assess/attempts/${attemptId}/responses/${q.test_question_id}`, { option_id: wrongRes.rows[0].option_id });
      expectedMarks -= 1;
      expectedWrong++;
    } else {
      expectedSkipped++; // left unanswered on purpose
    }
  }
  console.log(`   ${CORRECT_COUNT} correct, ${WRONG_COUNT} wrong, ${expectedSkipped} unanswered submitted`);

  console.log("5. emitting a couple attempt events");
  await call("POST", `/assess/attempts/${attemptId}/events`, { event_type: "focus_lost", event_payload: { at: "q5" } });
  await call("POST", `/assess/attempts/${attemptId}/events`, { event_type: "focus_regained", event_payload: { at: "q5" } });

  console.log("6. POST /assess/attempts/:id/submit");
  const submitRes = await call("POST", `/assess/attempts/${attemptId}/submit`);
  console.log(`   attempt_state=${submitRes.data.attempt.attempt_state}`);

  console.log("7. GET /assess/attempts/:id/scorecard");
  const scorecardRes = await call("GET", `/assess/attempts/${attemptId}/scorecard`);
  const actual = scorecardRes.data.scorecard;

  console.log("\n--- expected vs actual ---");
  console.table([
    { metric: "obtained_marks", expected: expectedMarks, actual: Number(actual.obtained_marks) },
    { metric: "correct_count (from submit response)", expected: expectedCorrect, actual: submitRes.data.scorecard.correctCount },
    { metric: "wrong_count (from submit response)", expected: expectedWrong, actual: submitRes.data.scorecard.wrongCount },
    { metric: "skipped_count (from submit response)", expected: expectedSkipped, actual: submitRes.data.scorecard.skippedCount },
  ]);

  const marksMatch = Number(actual.obtained_marks) === expectedMarks;
  console.log(marksMatch ? "\nPASS: obtained_marks matches expected +4/-1/0 arithmetic." : "\nFAIL: obtained_marks does NOT match.");

  await pool.end();
  if (!marksMatch) process.exitCode = 1;
}

main().catch((err) => {
  console.error("e2e attempt proof failed:", err);
  process.exitCode = 1;
});
