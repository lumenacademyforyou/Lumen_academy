import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../../shared/pool.js";

// LA-BE-CORE-002 CL-P8 task 1. Produces the platform root (a real
// super_admin — confirmed live before writing this that zero exist in this
// database, meaning the last-super-admin trigger from 009_core_rbac.sql has
// had nothing to protect until this script runs), one institution, and one
// user of every type from section 5. Every account uses the
// @lumen.internal address family already established by the pre-existing
// e2e-test-student@lumen.internal / legacy-import@lumen.internal seed rows,
// with email_confirm: true — no confirmation email is ever sent, so this
// never touches the two-per-hour Supabase email quota.
//
// Idempotent: every Supabase user is created with a fixed, deterministic
// email; if admin.createUser reports the email already exists, this looks
// the existing auth user up instead of erroring, and every core.* write is
// an upsert on a real unique constraint (auth_user_id, or the specific
// institution_code below). Safe to run repeatedly.
//
// Usage: npx tsx db/scripts/seed/02_core_lifecycle_fixture.ts [--dry-run]

const DRY_RUN = process.argv.includes("--dry-run");
const PASSWORD = "LumenPilot-Seed-2026!";
const INSTITUTION_CODE = "LUMEN-PILOT-001";

const FIXTURE_USERS: { label: string; email: string; roleCode: string; needsInstitution: boolean }[] = [
  { label: "Platform Root", email: "super-admin@lumen.internal", roleCode: "super_admin", needsInstitution: false },
  { label: "Platform Admin", email: "platform-admin@lumen.internal", roleCode: "platform_admin", needsInstitution: false },
  { label: "Institution Admin", email: "institution-admin@lumen.internal", roleCode: "institution_admin", needsInstitution: true },
  { label: "Educator", email: "educator@lumen.internal", roleCode: "educator", needsInstitution: true },
  { label: "Student", email: "student@lumen.internal", roleCode: "student", needsInstitution: false },
];

async function main() {
  console.log(DRY_RUN ? "--- DRY RUN: no writes will happen ---" : "--- LIVE RUN ---");
  console.log(`Plan: 1 institution (${INSTITUTION_CODE}), ${FIXTURE_USERS.length} users — ${FIXTURE_USERS.map((u) => u.roleCode).join(", ")}.`);

  if (DRY_RUN) {
    await pool.end();
    return;
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run this script live.");
  }
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const instRes = await pool.query<{ institution_id: string }>(
    `insert into core.institution (institution_code, name, institution_type, status)
     values ($1, $2, 'platform', 'active')
     on conflict (institution_code) do update set name = excluded.name
     returning institution_id`,
    [INSTITUTION_CODE, "Lumen Academy Pilot Institution"]
  );
  const institutionId = instRes.rows[0].institution_id;
  console.log(`institution: ${INSTITUTION_CODE} -> ${institutionId}`);

  for (const fixture of FIXTURE_USERS) {
    let authUserId: string;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: fixture.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: fixture.label },
    });
    if (created.user) {
      authUserId = created.user.id;
      console.log(`auth user: ${fixture.email} -> created (${authUserId})`);
    } else if (createErr?.code === "email_exists") {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) throw new Error(`listUsers failed while resolving ${fixture.email}: ${listErr.message}`);
      const existing = list.users.find((u: { email?: string; id: string }) => u.email === fixture.email);
      if (!existing) throw new Error(`email_exists reported for ${fixture.email} but it was not found in listUsers()`);
      authUserId = existing.id;
      console.log(`auth user: ${fixture.email} -> already existed (${authUserId})`);
    } else {
      throw new Error(`createUser(${fixture.email}) failed: ${createErr?.message}`);
    }

    const targetInstitutionId = fixture.needsInstitution ? institutionId : null;
    const appUserRes = await pool.query<{ user_id: string }>(
      `insert into core.app_user (auth_user_id, email, mobile_number, full_name, user_role, status, institution_id)
       values ($1, $2, null, $3, $4, 'active', $5)
       on conflict (auth_user_id) do update set full_name = excluded.full_name
       returning user_id`,
      [authUserId, fixture.email, fixture.label, fixture.roleCode, targetInstitutionId]
    );
    const appUserId = appUserRes.rows[0].user_id;

    await pool.query(
      `insert into public.users (id, email, display_name, created_at, updated_at)
       values ($1, $2, $3, now(), now())
       on conflict (id) do update set id = excluded.id`,
      [authUserId, fixture.email, fixture.label]
    );

    await pool.query(
      `insert into core.user_role_assignment (user_id, role_id, institution_id, granted_by, granted_at)
       select $1, role_id, $2, $1, now() from core.role where role_code = $3
       on conflict do nothing`,
      [appUserId, targetInstitutionId, fixture.roleCode]
    );

    console.log(`  core.app_user: ${fixture.roleCode} -> ${appUserId}`);
  }

  await pool.end();
  console.log(`\ndone. Every fixture account's password is: ${PASSWORD}`);
}

main().catch((err) => {
  console.error("02_core_lifecycle_fixture seed failed:", err);
  process.exitCode = 1;
});
