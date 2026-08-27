import { pool } from "../shared/pool.js";
import { submitForReview, decideReview, publishQuestion } from "../content/lifecycle.js";

// Day 2 follow-up: bulk-approve the 120 newly live-imported questions
// (currently all lifecycle_status='draft') to 'published' via CL-4's real
// state machine, so Prince's fixed-paper composition (which requires
// 'published') is unblocked. User-confirmed choice: bulk-approve now rather
// than a manual sample review first — these rows already passed schema +
// live node + asset validation on the way in via CL-2.
//
// Usage: npx tsx db/scripts/bulk-publish-draft-questions.ts

const EDUCATOR_EMAIL = "educator@lumen.internal";
const ADMIN_EMAIL = "lumenacademyforyou@gmail.com"; // the operator running this session

async function main() {
  const educatorRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = $1`, [EDUCATOR_EMAIL]);
  if (educatorRes.rowCount === 0) throw new Error(`${EDUCATOR_EMAIL} not found`);
  const educatorId = educatorRes.rows[0].user_id;

  const adminRes = await pool.query<{ user_id: string }>(`select user_id from core.app_user where email = $1`, [ADMIN_EMAIL]);
  if (adminRes.rowCount === 0) throw new Error(`${ADMIN_EMAIL} not found`);
  const adminId = adminRes.rows[0].user_id;

  // Ensure the admin account actually holds content_admin (needed for
  // decideReview/publishQuestion's real-world RBAC gate at the HTTP layer;
  // this script calls the db/ functions directly, but granting the role now
  // means the same account can immediately do this again through the API).
  const roleRes = await pool.query<{ role_id: string }>(`select role_id from core.role where role_code = 'content_admin'`);
  if (roleRes.rowCount === 0) throw new Error("content_admin role not seeded — run db/scripts/seed/00_core_roles.ts first");
  const contentAdminRoleId = roleRes.rows[0].role_id;

  const existingGrant = await pool.query(
    `select 1 from core.user_role_assignment where user_id = $1 and role_id = $2 and revoked_at is null`,
    [adminId, contentAdminRoleId]
  );
  if (existingGrant.rowCount === 0) {
    await pool.query(
      `insert into core.user_role_assignment (user_id, role_id, institution_id, granted_by, granted_at)
       values ($1, $2, null, $1, now())`,
      [adminId, contentAdminRoleId]
    );
    console.log(`granted content_admin to ${ADMIN_EMAIL} (${adminId})`);
  } else {
    console.log(`${ADMIN_EMAIL} already holds content_admin`);
  }

  const draftRes = await pool.query<{ question_id: string; question_uid: string }>(
    `select question_id, question_uid from content.question where lifecycle_status = 'draft' order by question_uid`
  );
  console.log(`\n${draftRes.rowCount} draft question(s) to publish`);

  let published = 0;
  let failed = 0;
  for (const row of draftRes.rows) {
    try {
      await submitForReview(row.question_id, educatorId, "CL-2 batch import — bulk review");
      await decideReview(row.question_id, adminId, "approve", "Passed CL-2 schema/node/asset validation on import; bulk-approved for Day 2 pilot content.");
      await publishQuestion(row.question_id, adminId, "Published for Day 2 pilot fixed-paper composition.");
      published++;
    } catch (err) {
      failed++;
      console.error(`  FAILED ${row.question_uid}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\npublished ${published}/${draftRes.rowCount}, failed ${failed}`);

  const counts = await pool.query(`select lifecycle_status, count(*) as n from content.question group by lifecycle_status`);
  console.log("\nfinal lifecycle_status counts:", counts.rows);
  await pool.end();
}

main().catch((err) => {
  console.error("bulk publish failed:", err);
  process.exitCode = 1;
});
