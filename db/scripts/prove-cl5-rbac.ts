import { pool } from "../shared/pool.js";
import { roleSetHasPermission } from "../../backend/lib/permissions.js";

// CL-5 proof (partial — LA-PLAN-002 Day 2 "first pass") — proves the exact
// authorization decision requirePermission makes for each content:*
// permission, against real live role assignments, without needing a running
// HTTP server + a real Supabase JWT (out of reach in this session). The
// route wiring itself (backend/routes/content.routes.ts) is typechecked and
// follows admin.routes.ts's already-proven [requireAuth, requirePermission(...)]
// pattern exactly — this proof covers the part that's genuinely new:
// whether the three new content:* permission codes actually resolve
// correctly against real role_permission grants.

async function rolesFor(email: string): Promise<string[]> {
  const res = await pool.query<{ role_code: string }>(
    `select r.role_code
       from core.user_role_assignment ura
       join core.role r on r.role_id = ura.role_id
       join core.app_user au on au.user_id = ura.user_id
      where au.email = $1 and ura.revoked_at is null`,
    [email]
  );
  return res.rows.map((r) => r.role_code);
}

async function main() {
  const educatorRoles = await rolesFor("educator@lumen.internal");
  const studentRoles = await rolesFor("student@lumen.internal");
  console.log(`educator@lumen.internal roles: ${educatorRoles.join(", ") || "(none)"}`);
  console.log(`student@lumen.internal roles: ${studentRoles.join(", ") || "(none)"}`);

  const checks: [string, string[], string, boolean][] = [
    ["educator can submit_review", educatorRoles, "content:submit_review", true],
    ["educator cannot review_decide (would be self-approving)", educatorRoles, "content:review_decide", false],
    ["educator cannot publish", educatorRoles, "content:publish", false],
    ["student cannot submit_review", studentRoles, "content:submit_review", false],
    ["student cannot review_decide", studentRoles, "content:review_decide", false],
    ["student cannot publish", studentRoles, "content:publish", false],
  ];

  let allPass = true;
  for (const [label, roles, permission, expected] of checks) {
    const actual = await roleSetHasPermission(roles, permission);
    const pass = actual === expected;
    allPass = allPass && pass;
    console.log(`${pass ? "PASS" : "FAIL"} — ${label}: expected ${expected}, got ${actual}`);
  }

  if (!allPass) throw new Error("one or more RBAC checks did not match the expected authorization decision");
  console.log("\nCL-5 RBAC PASS — content:* permissions resolve correctly for real role assignments (this is exactly what requirePermission checks per-request).");
  await pool.end();
}

main().catch((err) => {
  console.error("CL-5 RBAC proof failed:", err);
  process.exitCode = 1;
});
