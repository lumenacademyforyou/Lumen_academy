import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../../shared/pool.js";

// Post docs/no-repeat-questions-fix.md's db/scripts/reset-user-data.ts run,
// core.app_user is intentionally at 0 rows (only the demo account's identity
// survives, and its core.app_user row provisions lazily on first sign-in) —
// but the db/assess/test/attempt/*.test.ts integration suite assumes a real
// core.app_user table with several distinct rows to run concurrent-draw and
// cross-user-isolation scenarios against. core.app_user.auth_user_id has a
// hard FK to auth.users (002_core.sql) — a plain INSERT can't fabricate a
// row, it has to go through Supabase Auth like every other real account.
//
// Same shape as db/scripts/seed/02_core_lifecycle_fixture.ts: idempotent
// (fixed deterministic emails, looked up if they already exist), student
// role, no institution needed. 12 accounts — one more than the largest
// row-count assumption in the existing test suite (concurrent-generation.
// test.ts's 4-way concurrent start plus other files' own offset picks).
//
// Usage: npx tsx db/scripts/seed/06_integration_test_fixture_users.ts

const PASSWORD = "LumenTestFixture-Seed-2026!";
const COUNT = 12;

async function main() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run this script.");
  }
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  for (let i = 1; i <= COUNT; i++) {
    const email = `test-fixture-${String(i).padStart(2, "0")}@lumen.internal`;
    let authUserId: string;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: `Test Fixture ${i}` },
    });
    if (created.user) {
      authUserId = created.user.id;
      console.log(`auth user: ${email} -> created (${authUserId})`);
    } else if (createErr?.code === "email_exists") {
      const { data: list, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (listErr) throw new Error(`listUsers failed while resolving ${email}: ${listErr.message}`);
      const existing = list.users.find((u: { email?: string; id: string }) => u.email === email);
      if (!existing) throw new Error(`email_exists reported for ${email} but it was not found in listUsers()`);
      authUserId = existing.id;
      console.log(`auth user: ${email} -> already existed (${authUserId})`);
    } else {
      throw new Error(`createUser(${email}) failed: ${createErr?.message}`);
    }

    const appUserRes = await pool.query<{ user_id: string }>(
      `insert into core.app_user (auth_user_id, email, mobile_number, full_name, user_role, status)
       values ($1, $2, null, $3, 'student', 'active')
       on conflict (auth_user_id) do update set full_name = excluded.full_name
       returning user_id`,
      [authUserId, email, `Test Fixture ${i}`]
    );
    console.log(`  core.app_user: ${appUserRes.rows[0].user_id}`);
  }

  console.log(`\nDone — ${COUNT} fixture accounts ready for the integration test suite.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
