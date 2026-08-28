import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../../../shared/pool.js";

// LA-BE-CORE-002 CL-P8 task 2. Covers: register (simulated — see below),
// sign in, read profile, update profile, an administrator grants a role,
// an administrator suspends the user, the suspended user is refused, an
// administrator restores the user, the user signs in again. Every step is
// asserted with assert(), not merely executed — a step whose assertion
// fails throws and the whole run reports a non-zero exit code.
//
// "Register... verify in the original tab" is simulated via
// admin.createUser({ email_confirm: true }) rather than the real signUp +
// email-OTP flow CL-P2 built: this script must be safe to run repeatedly in
// CI/local dev without ever consuming the two-per-hour Supabase email
// quota, which the real flow would do on every run. The registration UI
// itself is exercised by hand, once, as part of CL-P2's own sign-off — not
// re-proven here on every run.
//
// Safe to run repeatedly: creates its own throwaway accounts/institution
// with a timestamped email, and deletes everything it created in a finally
// block regardless of pass or fail.
//
// Usage: BASE_URL=http://localhost:4000/api npx tsx db/scripts/e2e/core_lifecycle.ts

const BASE = process.env.BASE_URL || "http://localhost:4000/api";
const PASSWORD = "E2E-Lifecycle-Test-Pw-1!";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SUPABASE_PUBLISHABLE_KEY are required.");
  }
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const anonFactory = () => createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });

  const stamp = Date.now();
  const studentEmail = `e2e-lifecycle-student-${stamp}@lumen.internal`;
  const adminEmail = `e2e-lifecycle-admin-${stamp}@lumen.internal`;
  const cleanupAuthIds: string[] = [];
  let institutionId: string | null = null;

  try {
    console.log("1. Register (simulated — see header comment) + first sign-in provisions the account...");
    const { data: studentAuth, error: studentErr } = await admin.auth.admin.createUser({
      email: studentEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "E2E Student" },
    });
    assert(!studentErr && studentAuth.user, `student account creation failed: ${studentErr?.message}`);
    cleanupAuthIds.push(studentAuth.user!.id);

    const studentAnon = anonFactory();
    const { data: studentSession, error: studentSignInErr } = await studentAnon.auth.signInWithPassword({ email: studentEmail, password: PASSWORD });
    assert(!studentSignInErr && studentSession.session, `student sign-in failed: ${studentSignInErr?.message}`);
    let studentToken = studentSession.session!.access_token;

    const meRes1 = await fetch(`${BASE}/me`, { headers: { Authorization: `Bearer ${studentToken}` } });
    assert(meRes1.status === 200, `GET /me after first sign-in expected 200, got ${meRes1.status}`);
    const me1 = await meRes1.json();
    assert(me1.user.primaryRole === "student", `expected primaryRole 'student', got '${me1.user.primaryRole}'`);
    assert(me1.user.status === "active", `expected status 'active' immediately after provisioning, got '${me1.user.status}'`);
    console.log("   OK — provisioned as student, active.");

    console.log("\n2. Read profile (GET /me) and update profile (PATCH /me)...");
    const patchRes = await fetch(`${BASE}/me`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${studentToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: "E2E Student Renamed", studentProfile: { targetYear: 2027, classLevel: "12th" } }),
    });
    assert(patchRes.status === 200, `PATCH /me expected 200, got ${patchRes.status}`);
    const patched = await patchRes.json();
    assert(patched.user.fullName === "E2E Student Renamed", "fullName did not update");
    assert(patched.user.studentProfile?.classLevel === "12th", "studentProfile.classLevel did not update");
    console.log("   OK — profile updated and confirmed via response.");

    console.log("\n3. An administrator (throwaway platform_admin) grants the student the 'educator' role...");
    const { data: adminAuth, error: adminErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: "E2E Admin" },
    });
    assert(!adminErr && adminAuth.user, `admin account creation failed: ${adminErr?.message}`);
    cleanupAuthIds.push(adminAuth.user!.id);

    const adminAnon = anonFactory();
    const { data: adminSession } = await adminAnon.auth.signInWithPassword({ email: adminEmail, password: PASSWORD });
    const adminToken = adminSession!.session!.access_token;
    const adminMeRes = await fetch(`${BASE}/me`, { headers: { Authorization: `Bearer ${adminToken}` } });
    const adminMe = await adminMeRes.json();
    const adminAppUserId = adminMe.user.appUserId as string;

    const instRes = await pool.query<{ institution_id: string }>(
      `insert into core.institution (institution_code, name, status) values ($1, $2, 'active') returning institution_id`,
      [`E2E-LIFECYCLE-${stamp}`, "E2E Lifecycle Test Institution"]
    );
    institutionId = instRes.rows[0].institution_id;
    await pool.query(
      `insert into core.user_role_assignment (user_id, role_id, institution_id, granted_by, granted_at)
       select $1, role_id, null, $1, now() from core.role where role_code = 'platform_admin'`,
      [adminAppUserId]
    );

    const grantRes = await fetch(`${BASE}/admin/users/${me1.user.appUserId}/roles`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ roleCode: "educator", institutionId }),
    });
    assert(grantRes.status === 200, `POST /admin/users/:id/roles expected 200, got ${grantRes.status}: ${await grantRes.text()}`);
    console.log("   OK — educator role granted.");

    console.log("\n4. An administrator suspends the user...");
    const suspendRes = await fetch(`${BASE}/admin/users/${me1.user.appUserId}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "suspended" }),
    });
    assert(suspendRes.status === 200, `suspend expected 200, got ${suspendRes.status}`);
    console.log("   OK — suspended.");

    console.log("\n5. The suspended user is refused (a fresh sign-in must fail)...");
    const blockedAnon = anonFactory();
    const { error: blockedErr } = await blockedAnon.auth.signInWithPassword({ email: studentEmail, password: PASSWORD });
    assert(!!blockedErr, "expected sign-in to fail for a suspended user, but it succeeded");
    console.log(`   OK — sign-in refused (${blockedErr!.message}).`);

    console.log("\n6. An administrator restores the user...");
    const restoreRes = await fetch(`${BASE}/admin/users/${me1.user.appUserId}/status`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ toStatus: "active" }),
    });
    assert(restoreRes.status === 200, `restore expected 200, got ${restoreRes.status}`);
    console.log("   OK — restored.");

    console.log("\n7. The user signs in again...");
    const finalAnon = anonFactory();
    const { data: finalSession, error: finalErr } = await finalAnon.auth.signInWithPassword({ email: studentEmail, password: PASSWORD });
    assert(!finalErr && finalSession.session, `sign-in after restore expected to succeed, got: ${finalErr?.message}`);
    const finalMeRes = await fetch(`${BASE}/me`, { headers: { Authorization: `Bearer ${finalSession.session!.access_token}` } });
    const finalMe = await finalMeRes.json();
    assert(finalMe.user.status === "active", `expected status 'active' after restore, got '${finalMe.user.status}'`);
    assert(finalMe.user.roles.some((r: any) => r.code === "educator"), "expected the educator role granted in step 3 to still be active");
    console.log("   OK — signed in again, status active, educator role persisted.");

    console.log("\nALL STEPS PASSED.");
  } finally {
    console.log("\nCleaning up...");
    for (const authUserId of cleanupAuthIds) {
      await pool.query("delete from learn.audit_log where actor_user_id in (select user_id from core.app_user where auth_user_id = $1)", [authUserId]);
      await pool.query("delete from core.user_role_assignment where user_id in (select user_id from core.app_user where auth_user_id = $1)", [authUserId]);
      await pool.query("delete from core.student_profile where user_id in (select user_id from core.app_user where auth_user_id = $1)", [authUserId]);
      await pool.query("delete from core.app_user where auth_user_id = $1", [authUserId]);
      await pool.query("delete from public.users where id = $1", [authUserId]);
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }
    if (institutionId) {
      await pool.query("delete from core.institution where institution_id = $1", [institutionId]);
    }
    await pool.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\nE2E FAILED:", err.message ?? err);
    process.exit(1);
  });
