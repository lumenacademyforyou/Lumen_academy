/**
 * prune-users — wipes every user's owned data, and deletes the accounts that
 * are not on an explicit keep-list.
 *
 * Distinct from db/scripts/reset-user-data.ts, which is all-or-nothing (wipe
 * every user and every account). This one is selective:
 *
 *   * EVERY user, kept or not, has their owned data wiped — attempts,
 *     responses, scorecards, exposure history, plans, notes, sessions.
 *   * Accounts on the keep-list survive as logins with a stable user_id, so
 *     nothing has to be re-provisioned and no "first login" side effects
 *     re-fire.
 *   * Accounts not on the keep-list are removed entirely: profile rows,
 *     app_user, the legacy public.users row, and the Supabase Auth identity.
 *
 * It deliberately REUSES db/shared/wipe-user-data.ts for the data wipe rather
 * than restating its FK graph. That routine already encodes several FK gaps
 * that were only found by running a real wipe and having it fail
 * (content.ai_generation_job.requested_by, content.import_batch.submitted_by,
 * content.question_review.reviewer_user_id, core.invitation.invited_by,
 * assess.test.created_by, learn.topic_mastery). Duplicating that knowledge
 * here would guarantee the two drift.
 *
 * Content is never touched: catalog.*, content.* and learn.unit_material are
 * curriculum, not user-owned data.
 *
 * Safety, matching reset-user-data.ts's convention:
 *   default            DRY RUN — prints exactly what would happen
 *   --i-know --execute both flags required; either alone stays a dry run
 *
 *   npx tsx db/scripts/prune-users.ts
 *   npx tsx db/scripts/prune-users.ts --i-know --execute
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { pool } from "../shared/pool.js";
import { wipeUserOwnedData } from "../shared/wipe-user-data.js";

const ACKNOWLEDGED = process.argv.includes("--i-know");
const EXECUTE = process.argv.includes("--execute");
const doIt = ACKNOWLEDGED && EXECUTE;

/**
 * Accounts that survive as logins. Everything else is deleted outright.
 *
 * lumenacademyforyou@gmail.com is on this list for a specific reason: it is
 * .env's SUPER_ADMIN_EMAIL *and* PILOT_ADMIN_EMAIL, so deleting it would
 * remove the platform super_admin and the pilot institution_admin bootstrap
 * identity, and RBAC would have to be re-bootstrapped.
 */
const KEEP_EMAILS = new Set([
  "demo.student@lumenacademy.dev", // the demo account
  "princeprince45613@gmail.com", // Prince
  "santhoshkumar.c412@gmail.com", // Santhosh Kumar
  "lumenacademyforyou@gmail.com", // Santhosh Kumar / platform super_admin
]);

/**
 * Integration-test fixtures. Kept as logins because the suite needs 12 real
 * core.app_user rows and auth_user_id has a hard FK to auth.users, so they
 * cannot be fabricated at test time — deleting them breaks the suite until
 * db/scripts/seed/06_integration_test_fixture_users.ts is re-run against
 * matching Auth identities. Their DATA is wiped like everyone else's.
 */
const KEEP_PATTERNS = [/^test-fixture-\d+@lumen\.internal$/i];

function isKept(email: string | null): boolean {
  if (!email) return false;
  return KEEP_EMAILS.has(email.toLowerCase()) || KEEP_PATTERNS.some((p) => p.test(email));
}

interface UserRow {
  user_id: string;
  auth_user_id: string | null;
  email: string | null;
  full_name: string | null;
  attempts: number;
}

async function main(): Promise<void> {
  console.log(`prune-users — ${doIt ? "EXECUTE" : "DRY RUN"}`);
  if (!doIt && (ACKNOWLEDGED || EXECUTE)) {
    console.log("  (both --i-know and --execute are required; staying in dry run)");
  }

  const users = (
    await pool.query<UserRow>(
      `select u.user_id, u.auth_user_id, u.email, u.full_name,
              (select count(*) from assess.attempt a where a.user_id = u.user_id)::int as attempts
         from core.app_user u
        order by coalesce(u.email, 'zzz')`
    )
  ).rows;

  const keep = users.filter((u) => isKept(u.email));
  const drop = users.filter((u) => !isKept(u.email));

  console.log(`\n  ${users.length} account(s) total\n`);
  console.log(`  KEEP as logins (data still wiped) — ${keep.length}`);
  for (const u of keep) console.log(`    ${u.email}  (${u.full_name ?? "?"}, ${u.attempts} attempts)`);
  console.log(`\n  DELETE entirely — ${drop.length}`);
  for (const u of drop) console.log(`    ${u.email}  (${u.full_name ?? "?"}, ${u.attempts} attempts)`);

  // Guard rail: this script exists to prune a handful of accounts. If the
  // keep-list ever fails to match anything, that is a configuration mistake,
  // not an instruction to delete every account on the platform.
  if (keep.length === 0) {
    throw new Error("refusing to run: the keep-list matched ZERO accounts — check KEEP_EMAILS/KEEP_PATTERNS");
  }

  if (!doIt) {
    console.log("\n  Dry run — nothing was deleted. Re-run with --i-know --execute.");
    return;
  }

  // 1. Wipe owned data for EVERY account in ONE unscoped pass.
  //
  // Deliberately not a loop of single-user wipes. That was the first attempt
  // and it failed live on fk_section_score_test_section_id: wiping user A
  // deletes A's generated assess.test_section rows, but user B's
  // section_score rows on that same shared test still reference them.
  // Unscoped, every section_score goes before any test_section, so the
  // ordering the shared routine already encodes is correct again.
  // keepIdentities leaves every core.app_user row standing; step 2 removes
  // only the ones that are not kept.
  console.log("\n  wiping owned data (all accounts)...");
  const res = await wipeUserOwnedData(pool, { keepIdentities: true });
  for (const [t, n] of Object.entries(res.counts).filter(([, n]) => n > 0).sort()) {
    console.log(`    ${t}: ${n}`);
  }

  // 2. Tear down the identities that are not kept.
  if (drop.length > 0) {
    const dropIds = drop.map((u) => u.user_id);
    const client = await pool.connect();
    try {
      await client.query("begin");

      // Sever audit/provenance references rather than deleting the audit rows
      // themselves — same ON DELETE SET NULL semantics migration 034/035 added
      // for exactly this, scoped here to the accounts being removed.
      const sever: [string, string][] = [
        ["content.ai_generation_job.requested_by", `update content.ai_generation_job set requested_by = null where requested_by = any($1::uuid[])`],
        ["content.import_batch.submitted_by", `update content.import_batch set submitted_by = null where submitted_by = any($1::uuid[])`],
        ["content.question_review.reviewer_user_id", `update content.question_review set reviewer_user_id = null where reviewer_user_id = any($1::uuid[])`],
        ["core.invitation.invited_by", `update core.invitation set invited_by = null where invited_by = any($1::uuid[])`],
        ["assess.test.created_by", `update assess.test set created_by = null where created_by = any($1::uuid[])`],
        ["core.user_role_assignment.granted_by", `update core.user_role_assignment set granted_by = null where granted_by = any($1::uuid[])`],
      ];
      for (const [label, sql] of sever) {
        const r = await client.query(sql, [dropIds]);
        if ((r.rowCount ?? 0) > 0) console.log(`    severed ${label}: ${r.rowCount}`);
      }

      for (const [label, sql] of [
        ["core.user_role_assignment", `delete from core.user_role_assignment where user_id = any($1::uuid[])`],
        ["core.student_profile", `delete from core.student_profile where user_id = any($1::uuid[])`],
        ["core.educator_profile", `delete from core.educator_profile where user_id = any($1::uuid[])`],
        ["core.app_user", `delete from core.app_user where user_id = any($1::uuid[])`],
      ] as [string, string][]) {
        const r = await client.query(sql, [dropIds]);
        console.log(`    deleted ${label}: ${r.rowCount}`);
      }

      // The legacy Prisma-track identity row, keyed by the same Auth id.
      // Missing it is what broke demo login after a previous full wipe.
      const authIds = drop.map((u) => u.auth_user_id).filter(Boolean) as string[];
      if (authIds.length > 0) {
        const r = await client.query(`delete from public.users where id = any($1::uuid[])`, [authIds]);
        console.log(`    deleted public.users: ${r.rowCount}`);
      }

      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw err;
    } finally {
      client.release();
    }

    // 3. Supabase Auth identities. core.app_user has no authority over
    //    auth.users — without this the same email can never sign up again.
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const admin = createClient(url, key).auth.admin;
      for (const u of drop) {
        if (!u.auth_user_id) continue;
        const { error } = await admin.deleteUser(u.auth_user_id);
        console.log(`    auth identity ${u.email}: ${error ? `FAILED — ${error.message}` : "deleted"}`);
      }
    } else {
      console.warn("    SUPABASE_URL/SERVICE_ROLE_KEY not set — Auth identities NOT deleted; those emails cannot sign up again until they are.");
    }
  }

  // 4. Verify.
  const after = await pool.query<{ users: string; attempts: string; seen: string; responses: string }>(
    `select (select count(*) from core.app_user)::text as users,
            (select count(*) from assess.attempt)::text as attempts,
            (select count(*) from assess.user_question_seen)::text as seen,
            (select count(*) from assess.attempt_response)::text as responses`
  );
  const a = after.rows[0];
  console.log(`\n  AFTER: ${a.users} account(s), ${a.attempts} attempt(s), ${a.responses} response(s), ${a.seen} exposure row(s)`);
  if (Number(a.attempts) > 0 || Number(a.seen) > 0) {
    console.warn("  !! expected zero attempts and zero exposure rows after a full data wipe");
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("prune-users failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
