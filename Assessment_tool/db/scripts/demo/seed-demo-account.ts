/**
 * seed-demo-account — P1-6 (docs/assessment-tool-fix-prompt.md).
 *
 * Unlike everything under db/scripts/manual/ (throwaway-DB-only, "never run
 * against production" per that directory's README), this script is meant to
 * run against the real database the live app uses. It seeds/refreshes ONE
 * fixed, well-known account (frontend/src/services/demoSession.ts's
 * DEMO_EMAIL) with a handful of realistic, fully-scored attempts, so the
 * "Try Demo Account" / "Quick Demo" entry points always land on a populated
 * dashboard and report instead of an empty "get started" state. Idempotent
 * and scoped only to that one account's own rows — safe to re-run on a
 * schedule (see the paired GitHub Actions workflow,
 * .github/workflows/reset-demo-account.yml).
 *
 * Deliberately does NOT reimplement identity provisioning: turning a fresh
 * Supabase Auth user into a core.app_user row is
 * backend/src/services/provisionUser.service.ts's job — its own header
 * comment explains how much concurrency-testing that logic took to get
 * right (two schemas, one transaction, a real race condition found and
 * fixed live). Duplicating even a trimmed-down version of it here for a
 * seed script would risk silently drifting from the real thing. Instead,
 * for a brand-new demo account, this makes one real `GET /api/me` call —
 * exactly what happens on any user's first real login — which needs a
 * locally running backend (`npm run dev:api`) to answer it. Every run after
 * the account already exists skips this step entirely and needs no server.
 *
 * Usage:
 *   npx tsx db/scripts/demo/seed-demo-account.ts            # top up to TARGET_ATTEMPTS, keep existing rows
 *   npx tsx db/scripts/demo/seed-demo-account.ts --reset    # wipe this account's attempts first, then reseed fresh
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../../shared/pool.js";
import { createPracticeTest, type PracticeTestLine } from "../../assess/test/definition/create-practice-test.js";
import { startAttempt, submitAttempt, type BatchResponseItem } from "../../assess/test/attempt/attempt-flow.js";
import { PoolInsufficientError } from "../../shared/errors.js";

const DEMO_EMAIL = "demo.student@lumenacademy.dev";
const DEMO_PASSWORD = "Demo-Student-Session-2026";
const DEMO_DISPLAY_NAME = "Prince A";
const TARGET_ATTEMPTS = 5;
const API_URL = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}/api`;
const RESET = process.argv.includes("--reset");

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function signInOrCreateDemoAuthUser(): Promise<{ authUserId: string; accessToken: string }> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY must be set (.env) to sign in the demo account.");
  const supabase = createClient(supabaseUrl, supabaseKey);

  const signIn = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (signIn.data.session) {
    return { authUserId: signIn.data.session.user.id, accessToken: signIn.data.session.access_token };
  }

  // First-ever run: this Supabase project has "Confirm email" enabled (see
  // supabaseAuth.ts's own comment on signUpWithPassword) — a plain
  // anon-key signUp() would succeed with no error but also no session,
  // leaving the account stuck unconfirmed and unusable (a real, separate
  // bug — see demoSession.ts's ensureDemoSession, now hardened to fail
  // loudly instead of silently in that same situation). A one-time
  // service-role admin.createUser({ email_confirm: true }) sidesteps that
  // for this one well-known fixed account, then a normal sign-in gets the
  // real session.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Demo account doesn't exist yet and SUPABASE_SERVICE_ROLE_KEY is not set — needed once to create it pre-confirmed (this Supabase project requires email confirmation for password sign-up)."
    );
  }
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const created = await adminClient.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: DEMO_DISPLAY_NAME },
  });
  if (created.error) {
    // Account already exists (e.g. a stuck-unconfirmed row from an earlier
    // manual "Try Demo Account" click, before this script existed) — find
    // it and force-confirm + reset its password instead of creating a
    // second one.
    if (!/already been registered|already registered/i.test(created.error.message)) {
      throw new Error(`Could not create the demo Supabase Auth user via the admin API: ${created.error.message}`);
    }
    const list = await adminClient.auth.admin.listUsers({ perPage: 200 });
    if (list.error) throw new Error(`Could not list Supabase Auth users to find the existing demo account: ${list.error.message}`);
    const users: { id: string; email?: string | null }[] = list.data.users;
    const existing = users.find((u) => u.email === DEMO_EMAIL);
    if (!existing) throw new Error(`Admin API reported the demo account already exists but it wasn't found in listUsers() — cannot recover automatically.`);
    const fixed = await adminClient.auth.admin.updateUserById(existing.id, { password: DEMO_PASSWORD, email_confirm: true });
    if (fixed.error) throw new Error(`Could not confirm/reset the existing demo account: ${fixed.error.message}`);
  }

  const signInAfterCreate = await supabase.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (signInAfterCreate.error || !signInAfterCreate.data.session) {
    throw new Error(`Demo account was created but sign-in still failed: ${signInAfterCreate.error?.message ?? "no session returned"}`);
  }
  return { authUserId: signInAfterCreate.data.session.user.id, accessToken: signInAfterCreate.data.session.access_token };
}

async function findAppUserId(authUserId: string): Promise<string | null> {
  const res = await pool.query<{ user_id: string }>(`select user_id from core.app_user where auth_user_id = $1`, [authUserId]);
  return res.rows[0]?.user_id ?? null;
}

async function provisionViaRealApi(accessToken: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new Error(
      `Could not reach the backend at ${API_URL} to provision the demo account's core.app_user row. ` +
        `Start it first with "npm run dev:api", then re-run this script. (Only needed once, for a brand-new demo account.)`
    );
  }
  if (!res.ok) throw new Error(`GET ${API_URL}/me returned ${res.status} while provisioning the demo account.`);

  // Fill in a realistic profile too, same real path a student's own
  // onboarding uses — best-effort, not fatal if this fails.
  await fetch(`${API_URL}/me`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: DEMO_DISPLAY_NAME,
      targetExam: "NEET",
      studentProfile: { targetYear: new Date().getFullYear() + 1, classLevel: "12", dailyStudyMinutes: 90 },
    }),
  }).catch(() => {});
}

async function resetDemoAttempts(userId: string): Promise<void> {
  console.log("--reset: clearing this demo account's existing attempts...");
  await pool.query(
    `delete from assess.section_score where scorecard_id in (
       select scorecard_id from assess.scorecard where attempt_id in (select attempt_id from assess.attempt where user_id = $1)
     )`,
    [userId]
  );
  await pool.query(`delete from assess.scorecard where attempt_id in (select attempt_id from assess.attempt where user_id = $1)`, [userId]);
  await pool.query(`delete from assess.attempt_response where attempt_id in (select attempt_id from assess.attempt where user_id = $1)`, [userId]);
  await pool.query(`delete from assess.attempt_event where attempt_id in (select attempt_id from assess.attempt where user_id = $1)`, [userId]);
  // attempt_question / attempt_pause cascade from attempt automatically.
  await pool.query(`delete from assess.attempt where user_id = $1`, [userId]);
  // Also clear exposure history so a reseed doesn't get skewed toward
  // "already seen" ordering from the wiped attempts.
  await pool.query(`delete from assess.user_question_seen where user_id = $1`, [userId]);
}

async function seedAttempts(userId: string, existingScoredCount: number): Promise<void> {
  const examRes = await pool.query<{ exam_id: string; exam_code: string }>(`select exam_id, exam_code from catalog.exam where is_active = true order by exam_id limit 1`);
  if (examRes.rowCount === 0) throw new Error("No active catalog.exam row — cannot seed demo attempts.");
  const { exam_id: examId, exam_code: examCode } = examRes.rows[0];

  const subjectsRes = await pool.query<{ subject_id: string; subject_code: string }>(`select subject_id, subject_code from catalog.subject where exam_id = $1 order by display_order`, [examId]);
  const subjects = subjectsRes.rows.map((r) => ({ subjectId: r.subject_id, subjectCode: r.subject_code }));
  if (subjects.length === 0) throw new Error("No catalog.subject rows for the active exam — cannot seed demo attempts.");

  const toCreate = TARGET_ATTEMPTS - existingScoredCount;
  if (toCreate <= 0) {
    console.log(`Demo account already has ${existingScoredCount} scored attempts (target ${TARGET_ATTEMPTS}) — nothing to seed.`);
    return;
  }

  // One subject-wise line per subject (cycled if there are more attempts to
  // create than subjects), each a moderate 15-question practice test —
  // deliberately not a 180-question full mock: this needs to succeed even
  // against a thin content pool, and PoolInsufficientError is caught and
  // skipped per-attempt below regardless.
  const plans = Array.from({ length: toCreate }, (_, i) => subjects[i % subjects.length]);

  let created = 0;
  for (let i = 0; i < plans.length; i++) {
    const subject = plans[i];
    try {
      const test = await createPracticeTest({
        examId,
        examCode,
        testType: "SUBJ",
        scopeCode: subject.subjectCode,
        title: `${subject.subjectCode} Practice`,
        durationMinutes: 30,
        createdBy: userId,
        lines: [{ subjectId: subject.subjectId, includeDescendants: true, pickCount: 15, sectionName: subject.subjectCode }],
      });
      await pool.query(`update assess.test set test_status = 'published' where test_id = $1`, [test.testId]);

      const attempt = await startAttempt(test.testId, userId);

      const questionsRes = await pool.query<{ question_id: string }>(
        `select question_id from assess.attempt_question where attempt_id = $1`,
        [attempt.attemptId]
      );

      const responses: BatchResponseItem[] = [];
      for (const q of questionsRes.rows) {
        // ~8% left unanswered — a realistic "skipped" rate rather than a
        // perfectly-answered paper.
        if (Math.random() < 0.08) continue;

        const optionsRes = await pool.query<{ option_id: string; is_correct: boolean }>(
          `select option_id, is_correct from content.question_option where question_id = $1 order by display_order`,
          [q.question_id]
        );
        if (optionsRes.rowCount === 0) continue; // non-MCQ question with no options to guess — leave unanswered

        // ~72% correct — a believable, not-perfect demo accuracy.
        const correct = optionsRes.rows.find((o) => o.is_correct);
        const pool_ = Math.random() < 0.72 && correct ? [correct] : optionsRes.rows.filter((o) => !o.is_correct);
        const chosen = pool_.length > 0 ? pool_[Math.floor(Math.random() * pool_.length)] : optionsRes.rows[0];

        responses.push({
          questionId: q.question_id,
          optionId: chosen.option_id,
          timeSpentSeconds: 30 + Math.floor(Math.random() * 90),
        });
      }

      const result = await submitAttempt(attempt.attemptId, userId, undefined, responses);

      // Spread across the last two weeks so "Recent Tests" and the score
      // trend read as a real history, not five attempts all at "just now".
      const when = daysAgo(Math.round(((plans.length - i) / plans.length) * 13));
      await pool.query(`update assess.attempt set started_at = $2, submitted_at = $2 where attempt_id = $1`, [attempt.attemptId, when.toISOString()]);
      await pool.query(`update assess.scorecard set generated_at = $2 where attempt_id = $1`, [attempt.attemptId, when.toISOString()]);

      created++;
      console.log(`  seeded ${subject.subjectCode} practice attempt: ${result.obtainedMarks}/${result.totalMarks} marks, dated ${when.toDateString()}`);
    } catch (err) {
      if (err instanceof PoolInsufficientError) {
        console.warn(`  skipped a ${subject.subjectCode} attempt — insufficient published pool (${err.available}/${err.requested}).`);
        continue;
      }
      throw err;
    }
  }
  console.log(`Seeded ${created}/${toCreate} new demo attempts.`);
}

async function main(): Promise<void> {
  console.log(`Seeding demo account (${DEMO_EMAIL})${RESET ? " with --reset" : ""}...`);
  const { authUserId, accessToken } = await signInOrCreateDemoAuthUser();

  let userId = await findAppUserId(authUserId);
  if (!userId) {
    console.log("No core.app_user row yet for the demo account — provisioning via a real GET /api/me call...");
    await provisionViaRealApi(accessToken);
    userId = await findAppUserId(authUserId);
    if (!userId) throw new Error("Provisioning call succeeded but core.app_user still has no matching row — aborting.");
  }

  if (RESET) await resetDemoAttempts(userId);

  const existingRes = await pool.query<{ n: string }>(`select count(*) as n from assess.attempt where user_id = $1 and attempt_state = 'scored'`, [userId]);
  await seedAttempts(userId, Number(existingRes.rows[0].n));

  console.log("Done.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
