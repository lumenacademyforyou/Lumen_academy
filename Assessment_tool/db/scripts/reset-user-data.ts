/**
 * reset-user-data — BUG-01 (docs/assessment-tool-debug-plan.md, Phase 1).
 *
 * Wipes every user and everything a user owns (attempts, plans, tasks, notes,
 * sessions, subscriptions...) so the app can "start fresh." Never touches
 * content: catalog.* and content.* (subjects, syllabus, questions, options,
 * translations, assets) and learn.unit_material are all untouched — the
 * shared db/shared/wipe-user-data.ts routine only ever deletes rows that
 * hang off core.app_user.
 *
 * This project has exactly one live database (no separate staging/prod
 * environment exists anywhere in its config — confirmed via db/config/env.ts
 * and backend/src/config/env.ts, neither defines an environment discriminator
 * beyond NODE_ENV, which only toggles build mode). The plan's own rule ("the
 * script refuses to run against production unless an explicit --i-know flag
 * plus an env check passes") can't be satisfied with a real env check that
 * doesn't exist, so the safeguard here is two independent flags instead of
 * one flag + a check that would be fake:
 *   - default (no flags): DRY RUN — counts every row that WOULD be deleted,
 *     prints the summary, deletes nothing.
 *   - --i-know: acknowledges this is destructive.
 *   - --execute: actually runs the delete (both flags required together;
 *     either alone stays a dry run).
 *
 * Idempotent: running it twice in a row leaves the same clean state (deleting
 * from an already-empty set of tables deletes 0 rows the second time; the
 * demo-user reseed step checks for an existing account before creating one).
 *
 * Usage:
 *   npx tsx db/scripts/reset-user-data.ts                    # dry run (safe, prints counts)
 *   npx tsx db/scripts/reset-user-data.ts --i-know --execute # actually deletes, then reseeds the demo user
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../shared/pool.js";
import { wipeUserOwnedData } from "../shared/wipe-user-data.js";
import { dbConfig } from "../config/env.js";
import { DEMO_EMAIL } from "../shared/demoAccount.js";

const ACKNOWLEDGED = process.argv.includes("--i-know");
const EXECUTE = process.argv.includes("--execute");
const DRY_RUN = !(ACKNOWLEDGED && EXECUTE);

async function countOnly(): Promise<void> {
  console.log("DRY RUN — nothing will be deleted. Pass both --i-know and --execute to actually run this.\n");
  const tables: [string, string][] = [
    ["core.app_user", `select count(*) from core.app_user`],
    ["assess.attempt", `select count(*) from assess.attempt`],
    ["assess.attempt_response", `select count(*) from assess.attempt_response`],
    ["assess.scorecard", `select count(*) from assess.scorecard`],
    ["assess.test (generated)", `select count(*) from assess.test where source_type = 'generated'`],
    ["learn.study_plan", `select count(*) from learn.study_plan`],
    ["learn.plan_task", `select count(*) from learn.plan_task`],
    ["learn.flashcard", `select count(*) from learn.flashcard`],
    ["learn.notification", `select count(*) from learn.notification`],
    ["core.user_session", `select count(*) from core.user_session`],
    ["core.subscription", `select count(*) from core.subscription`],
    ["core.enrollment", `select count(*) from core.enrollment`],
  ];
  for (const [label, sql] of tables) {
    const res = await pool.query<{ count: string }>(sql);
    console.log(`  would delete up to ${res.rows[0].count} rows from ${label}`);
  }
  console.log(`\nContent tables (catalog.*, content.*, learn.unit_material) are never touched by this script.`);
  console.log(`Re-run with --i-know --execute to actually wipe and reseed one demo user.`);
}

async function deleteAuthUsers(authUserIds: string[]): Promise<void> {
  const serviceRoleKey = dbConfig.supabaseServiceRoleKey;
  if (!serviceRoleKey) {
    console.warn(
      `SUPABASE_SERVICE_ROLE_KEY is not set — skipped deleting ${authUserIds.length} Supabase Auth identities. ` +
        `Their core.app_user rows are gone, but the same email/phone can't be used to sign up again until these ` +
        `auth.users rows are removed by hand or this script is re-run with the key set.`
    );
    return;
  }
  const admin = createClient(dbConfig.supabaseUrl, serviceRoleKey);
  let failures = 0;
  for (const id of authUserIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      failures++;
      console.warn(`  could not delete auth user ${id}: ${error.message}`);
    }
  }
  console.log(`Deleted ${authUserIds.length - failures}/${authUserIds.length} Supabase Auth identities.`);
}

async function seedOneDemoUser(): Promise<void> {
  const serviceRoleKey = dbConfig.supabaseServiceRoleKey;
  if (!serviceRoleKey) {
    console.warn(`SUPABASE_SERVICE_ROLE_KEY is not set — cannot pre-provision the demo Auth user. Skipping seed step.`);
    return;
  }
  const admin = createClient(dbConfig.supabaseUrl, serviceRoleKey);
  const list = await admin.auth.admin.listUsers({ perPage: 200 });
  if (list.error) throw new Error(`Could not list Supabase Auth users: ${list.error.message}`);
  const users: { id: string; email?: string | null }[] = list.data.users;
  const existing = users.find((u) => u.email === DEMO_EMAIL);
  if (existing) {
    console.log(`Demo account (${DEMO_EMAIL}) already exists in Supabase Auth — its core.app_user row will be lazily`);
    console.log(`re-created (empty) the next time it signs in, via requireAuth's provisionCanonicalUser. Nothing to seed here.`);
    return;
  }
  const created = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: "Demo-Student-Session-2026",
    email_confirm: true,
    user_metadata: { display_name: "Prince A" },
  });
  if (created.error) throw new Error(`Could not create the demo Supabase Auth user: ${created.error.message}`);
  console.log(`Created the demo Auth identity (${DEMO_EMAIL}). Its core.app_user row is provisioned automatically`);
  console.log(`on first sign-in (requireAuth's provisionCanonicalUser) — no separate seed step needed here.`);
}

async function main(): Promise<void> {
  if (DRY_RUN) {
    await countOnly();
    return;
  }

  console.log("Wiping ALL users and user-owned data. Content tables are untouched.\n");
  const { counts, authUserIds } = await wipeUserOwnedData(pool);
  console.log("Deleted:");
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table}: ${n}`);
  }
  await deleteAuthUsers(authUserIds);
  await seedOneDemoUser();
  console.log("\nDone. Run again with no flags to verify a second run deletes 0 rows (idempotency check).");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
