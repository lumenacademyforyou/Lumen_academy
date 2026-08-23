import { pool } from "../../shared/pool.js";

// LA-BE-CORE-002 CL-P6. core.role, core.permission and core.role_permission
// were created by 009_core_rbac.sql but never seeded — core.role has zero
// rows in the live database (confirmed live before writing this script),
// which means core.user_role_assignment is currently unusable (its FK has
// nothing to reference) despite every table, trigger and check constraint
// for it already existing. This seeds the reference data those tables were
// built for, plus backfills a real user_role_assignment row for every
// already-provisioned core.app_user row (matching its current denormalized
// user_role column) so existing accounts don't start permission-less the
// moment requirePermission.ts starts reading the assignment table instead
// of that column.
//
// Idempotent: every insert is ON CONFLICT on the table's own unique
// constraint (uq_role_code, uq_permission_code, pk_role_permission), and the
// backfill only inserts an assignment where none already exists for that
// (user_id, role_id, institution) triple (uq_user_role_active already
// enforces this at the DB level too — this check just avoids a redundant
// INSERT attempt on every re-run).
//
// Permission set is deliberately small: catalog:write and admin:stats are
// the only two real, currently-existing gaps this phase found (catalog
// write routes and the legacy admin/stats route are both wide open to any
// authenticated user today — see catalog.routes.ts's own comment and
// backend/routes/api.ts's /admin/stats). Not inventing permissions for
// endpoints CL-P7 hasn't built yet.
//
// Usage: npx tsx db/scripts/seed/00_core_roles.ts [--dry-run]

const DRY_RUN = process.argv.includes("--dry-run");

const ROLES: { code: string; name: string; scope: "platform" | "institution" }[] = [
  { code: "super_admin", name: "Super Administrator", scope: "platform" },
  { code: "platform_admin", name: "Platform Administrator", scope: "platform" },
  { code: "content_admin", name: "Content Administrator", scope: "platform" },
  { code: "content_reviewer", name: "Content Reviewer", scope: "platform" },
  { code: "institution_admin", name: "Institution Administrator", scope: "institution" },
  { code: "educator", name: "Educator", scope: "institution" },
  // "platform", not "institution": found while writing the backfill query
  // below — core.trg_role_assignment_scope requires a platform-scoped
  // assignment's institution_id to be NULL and an institution-scoped one's
  // to be NOT NULL. Section 5 of this brief models students as "zero or one"
  // institution (self-registration produces NULL, by DC-8's own design), so
  // the student *role* — the authority level, distinct from the student's
  // own institution membership already tracked on core.app_user.institution_id
  // — has to be platform-scoped or every institution-less self-registered
  // student would fail this INSERT outright.
  { code: "student", name: "Student", scope: "platform" },
  { code: "system", name: "System / Automation Account", scope: "platform" },
];

const PERMISSIONS: { code: string; description: string }[] = [
  { code: "catalog:write", description: "Create, update or delete catalog reference data (exams, patterns, syllabus, marking schemes)." },
  { code: "admin:stats", description: "View platform-wide administrative statistics." },
  { code: "users:invite", description: "Invite a new user (platform_admin, institution_admin or educator) by email." },
  { code: "users:manage_platform", description: "List, read, update and change the status of any user platform-wide." },
  { code: "users:manage_institution", description: "List, read, update and change the status of users within one's own institution." },
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ["catalog:write", "admin:stats", "users:invite", "users:manage_platform"],
  platform_admin: ["catalog:write", "admin:stats", "users:invite", "users:manage_platform"],
  content_admin: ["catalog:write"],
  content_reviewer: [],
  institution_admin: ["users:invite", "users:manage_institution"],
  educator: [],
  student: [],
  system: ["catalog:write"],
};

async function main() {
  console.log(DRY_RUN ? "--- DRY RUN: no writes will happen ---" : "--- LIVE RUN ---");
  console.log(`Plan: ${ROLES.length} roles, ${PERMISSIONS.length} permissions, role_permission grants for ${Object.values(ROLE_PERMISSIONS).flat().length} (role, permission) pairs, plus a one-time backfill of user_role_assignment for existing core.app_user rows.`);

  if (DRY_RUN) {
    for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
      console.log(`  ${role}: ${perms.length ? perms.join(", ") : "(no permissions granted)"}`);
    }
    await pool.end();
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const roleIds = new Map<string, string>();
    for (const role of ROLES) {
      const res = await client.query<{ role_id: string }>(
        `insert into core.role (role_code, role_name, scope_level, is_system)
         values ($1, $2, $3, true)
         on conflict (role_code) do update set role_name = excluded.role_name, scope_level = excluded.scope_level
         returning role_id`,
        [role.code, role.name, role.scope]
      );
      roleIds.set(role.code, res.rows[0].role_id);
      console.log(`role: ${role.code} -> ${res.rows[0].role_id}`);
    }

    const permissionIds = new Map<string, string>();
    for (const perm of PERMISSIONS) {
      const res = await client.query<{ permission_id: string }>(
        `insert into core.permission (permission_code, description)
         values ($1, $2)
         on conflict (permission_code) do update set description = excluded.description
         returning permission_id`,
        [perm.code, perm.description]
      );
      permissionIds.set(perm.code, res.rows[0].permission_id);
      console.log(`permission: ${perm.code} -> ${res.rows[0].permission_id}`);
    }

    let grantCount = 0;
    for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
      const roleId = roleIds.get(roleCode);
      if (!roleId) throw new Error(`no role_id resolved for ${roleCode}`);
      for (const permCode of permCodes) {
        const permissionId = permissionIds.get(permCode);
        if (!permissionId) throw new Error(`no permission_id resolved for ${permCode}`);
        await client.query(
          `insert into core.role_permission (role_id, permission_id)
           values ($1, $2)
           on conflict (role_id, permission_id) do nothing`,
          [roleId, permissionId]
        );
        grantCount++;
      }
    }
    console.log(`role_permission: ensured ${grantCount} grants`);

    // Backfill: every core.app_user row that has no active assignment for
    // its own denormalized user_role gets one. Written as a single set-based
    // insert (not a per-row loop) so it stays correct if this script is ever
    // re-run against a larger table.
    const backfill = await client.query(
      `insert into core.user_role_assignment (user_id, role_id, institution_id, granted_by, granted_at)
       select au.user_id, r.role_id,
              case when r.scope_level = 'institution' then au.institution_id else null end,
              au.user_id, now()
         from core.app_user au
         join core.role r on r.role_code = au.user_role
        where not exists (
          select 1 from core.user_role_assignment ura
           where ura.user_id = au.user_id and ura.role_id = r.role_id and ura.revoked_at is null
        )`
    );
    console.log(`user_role_assignment backfill: inserted ${backfill.rowCount} row(s) for existing app_user rows`);

    await client.query("commit");
    console.log("\ncommitted.");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("00_core_roles seed failed:", err);
  process.exitCode = 1;
});
