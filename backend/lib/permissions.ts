import { pool } from "../../db/shared/pool.js";

// LA-BE-CORE-002 CL-P6. The permission model as data, not scattered
// conditions — but "as data" means the database rows core.role/
// core.permission/core.role_permission actually are, not a parallel
// hardcoded object that would drift from them. This loads those tables into
// an in-memory map once at startup (and on demand via refreshPermissionCache)
// rather than re-querying on every request; role/permission grants change
// rarely enough that this tradeoff is the right one for a pilot.

interface PermissionCache {
  // role_code -> Set of permission_code
  rolePermissions: Map<string, Set<string>>;
  loadedAt: number;
}

let cache: PermissionCache | null = null;

async function loadPermissionCache(): Promise<PermissionCache> {
  const rows = await pool.query<{ role_code: string; permission_code: string }>(
    `select r.role_code, p.permission_code
       from core.role_permission rp
       join core.role r on r.role_id = rp.role_id
       join core.permission p on p.permission_id = rp.permission_id`
  );
  const rolePermissions = new Map<string, Set<string>>();
  for (const row of rows.rows) {
    if (!rolePermissions.has(row.role_code)) rolePermissions.set(row.role_code, new Set());
    rolePermissions.get(row.role_code)!.add(row.permission_code);
  }
  return { rolePermissions, loadedAt: Date.now() };
}

export async function refreshPermissionCache(): Promise<void> {
  cache = await loadPermissionCache();
}

async function getCache(): Promise<PermissionCache> {
  if (!cache) cache = await loadPermissionCache();
  return cache;
}

// True if any of the given role codes carries the required permission.
export async function roleSetHasPermission(roleCodes: string[], permissionCode: string): Promise<boolean> {
  const { rolePermissions } = await getCache();
  return roleCodes.some((code) => rolePermissions.get(code)?.has(permissionCode) ?? false);
}

// Authority ranking for role-escalation guards (CL-P6 task 4) — mirrors
// db/migrations/009_core_rbac.sql's trg_sync_app_user_role trigger's own
// CASE ordering exactly, so "who outranks whom" is defined in exactly one
// place conceptually even though it has to exist in both SQL and here (the
// trigger needs it to pick the denormalized column's value; this needs it to
// decide who may grant what — different jobs, can't share one definition
// across a network boundary, but must never be allowed to disagree).
const ROLE_RANK: Record<string, number> = {
  super_admin: 1,
  platform_admin: 2,
  content_admin: 3,
  institution_admin: 4,
  content_reviewer: 5,
  educator: 6,
  student: 7,
  system: 8,
};

// Lower rank number = higher authority. Unranked codes are never grantable
// (fail closed rather than let an unrecognised role code slip through).
export function canGrantRole(granterRoleCodes: string[], targetRoleCode: string): boolean {
  const targetRank = ROLE_RANK[targetRoleCode];
  if (targetRank === undefined) return false;
  const granterBestRank = Math.min(...granterRoleCodes.map((c) => ROLE_RANK[c] ?? Infinity));
  // Strictly greater authority required, not equal — matches "no user may
  // grant a role above their own authority" (CL-P6 task 4): a role can't
  // grant its own rank either, since granting a peer role is still not
  // something the brief says any role may do to itself.
  return granterBestRank < targetRank;
}
