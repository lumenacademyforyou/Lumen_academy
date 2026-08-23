import { z } from "zod";
import { pool } from "../../db/shared/pool.js";
import { supabaseAuth } from "../supabaseClient.js";
import { getSupabaseAdmin } from "../supabaseAdmin.js";
import { canGrantRole } from "../lib/permissions.js";
import { AppError } from "../middleware/errorHandler.js";
import type { InvitationContext } from "./invitation.service.js";

// LA-BE-CORE-002 CL-P7 — user lifecycle administration.

function isPlatformScoped(roleCodes: string[]): boolean {
  return roleCodes.includes("super_admin") || roleCodes.includes("platform_admin");
}

async function writeAuditRow(actorAppUserId: string, actionName: string, targetUserId: string, payload: Record<string, unknown>): Promise<void> {
  await pool.query(
    `insert into learn.audit_log (actor_user_id, actor_type, action_name, entity_name, entity_key, change_payload, occurred_at)
     values ($1, 'user', $2, 'core.app_user', $3, $4::jsonb, now())`,
    [actorAppUserId, actionName, targetUserId, JSON.stringify(payload)]
  );
}

export const listUsersQuerySchema = z
  .object({
    status: z.enum(["awaiting_verification", "active", "suspended", "locked", "deleted"]).optional(),
    roleCode: z.string().trim().optional(),
    search: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export async function listUsers(ctx: InvitationContext, query: ListUsersQuery) {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (!isPlatformScoped(ctx.callerRoleCodes)) {
    params.push(ctx.callerInstitutionId);
    conditions.push(`au.institution_id = $${params.length}`);
  }
  if (query.status) {
    params.push(query.status);
    conditions.push(`au.status = $${params.length}`);
  }
  if (query.roleCode) {
    params.push(query.roleCode);
    conditions.push(`au.user_role = $${params.length}`);
  }
  if (query.search) {
    params.push(`%${query.search.toLowerCase()}%`);
    conditions.push(`(lower(au.full_name) like $${params.length} or lower(au.email) like $${params.length})`);
  }
  const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
  const countParams = [...params];

  params.push(query.pageSize, (query.page - 1) * query.pageSize);
  const rows = await pool.query(
    `select au.user_id, au.email, au.full_name, au.user_role, au.status, au.institution_id, au.last_login_at
       from core.app_user au
       ${where}
      order by au.email
      limit $${params.length - 1} offset $${params.length}`,
    params
  );
  const countRes = await pool.query<{ count: string }>(`select count(*) from core.app_user au ${where}`, countParams);

  return { data: rows.rows, total: Number(countRes.rows[0].count), page: query.page, pageSize: query.pageSize };
}

export async function getUserDetail(ctx: InvitationContext, targetUserId: string) {
  const res = await pool.query(
    `select au.*, coalesce(string_agg(distinct r.role_code, ','), '') as active_role_codes
       from core.app_user au
       left join core.user_role_assignment ura on ura.user_id = au.user_id and ura.revoked_at is null
       left join core.role r on r.role_id = ura.role_id
      where au.user_id = $1
      group by au.user_id`,
    [targetUserId]
  );
  if (res.rowCount === 0) throw new AppError(404, "NOT_FOUND", "User not found.");
  const row = res.rows[0];
  if (!isPlatformScoped(ctx.callerRoleCodes) && row.institution_id !== ctx.callerInstitutionId) {
    // 404, not 403 — matches this codebase's existing scope-refusal convention.
    throw new AppError(404, "NOT_FOUND", "User not found.");
  }
  return row;
}

// Fields an admin may change on someone else's behalf. Deliberately the
// same shape as backend/services/meProfile.service.ts's self-service
// updateProfileSchema minus studentProfile (that's the user's own to
// manage) — status and role changes go through the dedicated endpoints
// below, each with its own authority rules, not this generic update.
export const adminUpdateUserSchema = z
  .object({
    fullName: z.string().trim().min(1).max(200).optional(),
    mobileNumber: z.string().trim().min(7).max(20).nullable().optional(),
    preferredLanguage: z.string().trim().max(10).nullable().optional(),
  })
  .strict();
export type AdminUpdateUserInput = z.infer<typeof adminUpdateUserSchema>;

export async function adminUpdateUser(ctx: InvitationContext, targetUserId: string, patch: AdminUpdateUserInput) {
  await getUserDetail(ctx, targetUserId); // scope check; throws 404 if out of scope

  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (column: string, value: unknown) => {
    values.push(value);
    sets.push(`${column} = $${values.length}`);
  };
  if (patch.fullName !== undefined) push("full_name", patch.fullName);
  if (patch.mobileNumber !== undefined) push("mobile_number", patch.mobileNumber);
  if (patch.preferredLanguage !== undefined) push("preferred_language", patch.preferredLanguage);

  if (sets.length > 0) {
    values.push(targetUserId);
    await pool.query(`update core.app_user set ${sets.join(", ")} where user_id = $${values.length}`, values);
  }
  return getUserDetail(ctx, targetUserId);
}

// Status transition table (CL-P7 task 5). 'deleted' is terminal — matches
// this phase's database-conformance rule ("deletion is not implemented...
// must be refused"); once deactivated, the path back is a new invitation/
// registration, not a restore, which is a deliberate product boundary, not
// an oversight. 'awaiting_verification' is only ever entered by CL-P2's own
// verification flow, never by this admin surface, so it isn't a valid
// target here even though it's a valid live status value.
const VALID_TRANSITIONS: Record<string, string[]> = {
  awaiting_verification: ["active", "suspended", "deleted"],
  active: ["suspended", "locked", "deleted"],
  suspended: ["active", "deleted"],
  locked: ["active", "deleted"],
  deleted: [],
};

export const transitionStatusSchema = z
  .object({ toStatus: z.enum(["active", "suspended", "locked", "deleted"]) })
  .strict();
export type TransitionStatusInput = z.infer<typeof transitionStatusSchema>;

export async function transitionUserStatus(ctx: InvitationContext, targetUserId: string, input: TransitionStatusInput, actorAppUserId: string) {
  const target = await getUserDetail(ctx, targetUserId);
  const allowed = VALID_TRANSITIONS[target.status] ?? [];
  if (!allowed.includes(input.toStatus)) {
    throw new AppError(409, "INVALID_STATE_TRANSITION", `Cannot transition from '${target.status}' to '${input.toStatus}'.`);
  }

  // Confirmed live (LA-BE-CORE-002 CL-P7, not assumed): banning the
  // underlying Supabase Auth identity invalidates every existing session
  // immediately, and un-banning resurrects whatever session existed before
  // the ban rather than requiring a fresh sign-in — so 'active'/restore
  // must explicitly clear the ban, not just flip the status label, or a
  // "suspended" user's stale browser tab would keep working the moment an
  // admin restores them without them ever having re-authenticated.
  const admin = getSupabaseAdmin();
  const banDuration = input.toStatus === "active" ? "none" : "876000h"; // ~100 years = indefinite until explicitly changed
  const { error: banErr } = await admin.auth.admin.updateUserById(target.auth_user_id, { ban_duration: banDuration });
  if (banErr) {
    throw new AppError(502, "AUTH_UPDATE_FAILED", `Could not update the underlying auth identity: ${banErr.message}`);
  }

  await pool.query(`update core.app_user set status = $1 where user_id = $2`, [input.toStatus, targetUserId]);
  await writeAuditRow(actorAppUserId, "status_changed", targetUserId, { from: target.status, to: input.toStatus });

  return getUserDetail(ctx, targetUserId);
}

export const grantRoleSchema = z
  .object({
    roleCode: z.string().trim(),
    institutionId: z.string().uuid().nullable().optional(),
  })
  .strict();
export type GrantRoleInput = z.infer<typeof grantRoleSchema>;

export async function grantRole(ctx: InvitationContext, targetUserId: string, input: GrantRoleInput, actorAppUserId: string) {
  // Role-escalation guard (CL-P6 task 4) applies to direct grants exactly as
  // it does to invitations — the same authority question either way.
  if (!canGrantRole(ctx.callerRoleCodes, input.roleCode)) {
    throw new AppError(403, "FORBIDDEN", `You do not have authority to grant ${input.roleCode}.`);
  }
  await getUserDetail(ctx, targetUserId); // scope check

  const callerPlatformScoped = isPlatformScoped(ctx.callerRoleCodes);
  let institutionId = input.institutionId ?? null;
  if (!callerPlatformScoped) {
    if (institutionId && institutionId !== ctx.callerInstitutionId) {
      throw new AppError(403, "FORBIDDEN", "You may only grant roles within your own institution.");
    }
    institutionId = ctx.callerInstitutionId;
  }

  const roleRows = await pool.query<{ role_id: string }>(`select role_id from core.role where role_code = $1`, [input.roleCode]);
  if (roleRows.rowCount === 0) {
    throw new AppError(400, "VALIDATION_ERROR", `Unknown role code '${input.roleCode}'.`);
  }

  await pool.query(
    `insert into core.user_role_assignment (user_id, role_id, institution_id, granted_by, granted_at)
     values ($1, $2, $3, $4, now())
     on conflict do nothing`,
    [targetUserId, roleRows.rows[0].role_id, institutionId, actorAppUserId]
  );
  return getUserDetail(ctx, targetUserId);
}

export async function revokeRole(ctx: InvitationContext, targetUserId: string, roleCode: string, actorAppUserId: string) {
  // Same authority question as granting: you cannot revoke a role you
  // could not have granted.
  if (!canGrantRole(ctx.callerRoleCodes, roleCode)) {
    throw new AppError(403, "FORBIDDEN", `You do not have authority to revoke ${roleCode}.`);
  }
  await getUserDetail(ctx, targetUserId); // scope check

  try {
    await pool.query(
      `update core.user_role_assignment ura set revoked_at = now()
         from core.role r
        where ura.role_id = r.role_id and r.role_code = $1 and ura.user_id = $2 and ura.revoked_at is null`,
      [roleCode, targetUserId]
    );
  } catch (err) {
    // core.trg_role_assignment_audit (009_core_rbac.sql) raises a plain
    // exception (not a typed SQLSTATE this codebase's errorHandler already
    // maps) when this would revoke the last active super_admin. Detected by
    // message rather than a dedicated error code, since the trigger itself
    // doesn't define one — surfaced as a clear 409 instead of the generic
    // 500 it would otherwise fall through to.
    if (err instanceof Error && err.message.includes("cannot revoke the last active super_admin")) {
      throw new AppError(409, "LAST_SUPER_ADMIN", "Cannot revoke the last active super_admin.");
    }
    throw err;
  }
  return getUserDetail(ctx, targetUserId);
}

// Confirmed live (CL-P7): a short ban invalidates every current session
// immediately and self-expires on its own — the closest this admin API
// surface gets to "sign this user out right now" without either a real
// suspension (indefinite ban) or needing that user's own current token
// (no admin method accepts a bare user id for session revocation; only
// admin.signOut(jwt) does, which needs the token this endpoint doesn't have).
export async function forceSignOut(ctx: InvitationContext, targetUserId: string, actorAppUserId: string): Promise<void> {
  const target = await getUserDetail(ctx, targetUserId);
  const { error } = await getSupabaseAdmin().auth.admin.updateUserById(target.auth_user_id, { ban_duration: "60s" });
  if (error) {
    throw new AppError(502, "AUTH_UPDATE_FAILED", `Could not force sign-out: ${error.message}`);
  }
  await writeAuditRow(actorAppUserId, "forced_sign_out", targetUserId, {});
}

const PASSWORD_RESET_COOLDOWN_MS = 60_000;

// Sends a real Supabase recovery email — the same shared two-per-hour
// project quota CL-P2's registration flow has to respect, so this is
// guarded by a cooldown the same way, checked against learn.audit_log
// rather than a new table (this is the only place that needs the history).
export async function forcePasswordReset(ctx: InvitationContext, targetUserId: string, actorAppUserId: string): Promise<void> {
  const target = await getUserDetail(ctx, targetUserId);

  const recent = await pool.query<{ occurred_at: string }>(
    `select occurred_at from learn.audit_log
      where entity_key = $1 and action_name = 'password_reset_forced'
      order by occurred_at desc limit 1`,
    [targetUserId]
  );
  if (recent.rowCount && recent.rowCount > 0) {
    const msSince = Date.now() - new Date(recent.rows[0].occurred_at).getTime();
    if (msSince < PASSWORD_RESET_COOLDOWN_MS) {
      throw new AppError(429, "RESEND_COOLDOWN", `Please wait ${Math.ceil((PASSWORD_RESET_COOLDOWN_MS - msSince) / 1000)}s before requesting another reset email for this user.`);
    }
  }

  const { error } = await supabaseAuth.auth.resetPasswordForEmail(target.email);
  if (error) {
    throw new AppError(502, "PASSWORD_RESET_SEND_FAILED", error.message);
  }
  await writeAuditRow(actorAppUserId, "password_reset_forced", targetUserId, {});
}
