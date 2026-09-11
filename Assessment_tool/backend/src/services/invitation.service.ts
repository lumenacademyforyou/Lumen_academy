import { z } from "zod";
import { pool } from "../../../db/shared/pool.js";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import { canGrantRole } from "../lib/permissions.js";
import { AppError } from "../middleware/errorHandler.js";

// LA-BE-CORE-002 CL-P6 task 5. Delivery goes through Supabase's own
// admin.inviteUserByEmail() (see db/migrations/015_core_invitation.sql's
// header for why this is link-based, not code-based like CL-P2). This
// service owns everything Supabase's own invite mechanism doesn't: who is
// allowed to invite whom into what, expiry, revocation that actually
// revokes, and a resend limit guarding the same two-per-hour project email
// quota CL-P2 already had to respect.

const INVITABLE_ROLES = ["platform_admin", "institution_admin", "educator"] as const;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_RESENDS = 3;
const INVITATION_TTL_DAYS = 7;

export const createInvitationSchema = z
  .object({
    email: z.string().trim().email(),
    roleCode: z.enum(INVITABLE_ROLES),
    institutionId: z.string().uuid().nullable().optional(),
  })
  .strict();

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export interface InvitationContext {
  callerAppUserId: string;
  callerRoleCodes: string[];
  callerInstitutionId: string | null;
}

function isPlatformScoped(roleCodes: string[]): boolean {
  return roleCodes.includes("super_admin") || roleCodes.includes("platform_admin");
}

export async function getInvitationContext(appUserId: string): Promise<InvitationContext> {
  const [roles, appUser] = await Promise.all([
    pool.query<{ role_code: string }>(
      `select r.role_code from core.user_role_assignment ura
        join core.role r on r.role_id = ura.role_id
       where ura.user_id = $1 and ura.revoked_at is null`,
      [appUserId]
    ),
    pool.query<{ institution_id: string | null }>(`select institution_id from core.app_user where user_id = $1`, [appUserId]),
  ]);
  return {
    callerAppUserId: appUserId,
    callerRoleCodes: roles.rows.map((r) => r.role_code),
    callerInstitutionId: appUser.rows[0]?.institution_id ?? null,
  };
}

export async function createInvitation(ctx: InvitationContext, input: CreateInvitationInput) {
  const { roleCode } = input;
  const email = input.email.trim().toLowerCase();

  // Role-escalation guard (CL-P6 task 4): strictly requires the caller's
  // best role to outrank the role being granted — a peer or lower role can
  // never be invited by this caller, institution_admin included.
  if (!canGrantRole(ctx.callerRoleCodes, roleCode)) {
    throw new AppError(403, "FORBIDDEN", `You do not have authority to invite a ${roleCode}.`);
  }

  const callerPlatformScoped = isPlatformScoped(ctx.callerRoleCodes);

  let institutionId: string | null;
  if (roleCode === "platform_admin") {
    // platform_admin has no institution, full stop, regardless of what the
    // request body asked for (section 5: "None").
    institutionId = null;
  } else {
    // institution_admin and educator always require exactly one institution
    // (section 5: "Exactly one"). A platform-scoped caller may name any
    // institution; an institution-scoped caller (institution_admin) may
    // only ever name their own — tenancy, not just role rank.
    if (!callerPlatformScoped && input.institutionId && input.institutionId !== ctx.callerInstitutionId) {
      throw new AppError(403, "FORBIDDEN", "You may only invite users into your own institution.");
    }
    institutionId = callerPlatformScoped ? (input.institutionId ?? null) : ctx.callerInstitutionId;
    if (!institutionId) {
      throw new AppError(400, "VALIDATION_ERROR", `institutionId is required to invite a ${roleCode}.`);
    }
  }

  // Guard before ever contacting Supabase — one pending invite per
  // email+role at a time (also enforced by the DB's own partial unique
  // index; this check exists to return a clear 409 instead of a raw
  // constraint-violation error, and to catch it before spending a send).
  const existing = await pool.query(`select 1 from core.invitation where lower(email) = $1 and role_code = $2 and status = 'pending'`, [
    email,
    roleCode,
  ]);
  if (existing.rowCount && existing.rowCount > 0) {
    throw new AppError(409, "INVITATION_ALREADY_PENDING", "An invitation for this email and role is already pending. Use resend, not a new invitation.");
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { invited_role: roleCode } });
  if (error || !data.user) {
    throw new AppError(502, "INVITE_SEND_FAILED", error?.message ?? "Could not send the invitation email.");
  }

  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const inserted = await pool.query(
    `insert into core.invitation (email, role_code, institution_id, invited_by, invited_auth_user_id, expires_at)
     values ($1, $2, $3, $4, $5, $6)
     returning invitation_id, email, role_code, institution_id, status, created_at, expires_at`,
    [email, roleCode, institutionId, ctx.callerAppUserId, data.user.id, expiresAt]
  );
  return inserted.rows[0];
}

export async function listInvitations(ctx: InvitationContext) {
  // Lazy expiry: flips any pending-but-past-due row to 'expired' on read
  // rather than needing a scheduled job this codebase has no infrastructure
  // for yet. provisionCanonicalUser also checks expires_at independently,
  // so a row that's overdue but hasn't been listed since is never honoured
  // either way.
  await pool.query(`update core.invitation set status = 'expired' where status = 'pending' and expires_at < now()`);

  if (isPlatformScoped(ctx.callerRoleCodes)) {
    const res = await pool.query(`select * from core.invitation order by created_at desc`);
    return res.rows;
  }
  const res = await pool.query(`select * from core.invitation where institution_id = $1 order by created_at desc`, [ctx.callerInstitutionId]);
  return res.rows;
}

async function getInvitationScoped(ctx: InvitationContext, invitationId: string) {
  const res = await pool.query(`select * from core.invitation where invitation_id = $1`, [invitationId]);
  if (res.rowCount === 0) throw new AppError(404, "NOT_FOUND", "Invitation not found.");
  const row = res.rows[0];
  if (!isPlatformScoped(ctx.callerRoleCodes) && row.institution_id !== ctx.callerInstitutionId) {
    // 404, not 403 — same reasoning as makeOwnedCrudRouter: a row outside
    // scope shouldn't be distinguishable from one that doesn't exist.
    throw new AppError(404, "NOT_FOUND", "Invitation not found.");
  }
  return row;
}

export async function revokeInvitation(ctx: InvitationContext, invitationId: string): Promise<void> {
  const row = await getInvitationScoped(ctx, invitationId);
  if (row.status !== "pending") {
    throw new AppError(409, "INVALID_STATE_TRANSITION", `Cannot revoke an invitation with status '${row.status}'.`);
  }
  if (row.invited_auth_user_id) {
    // Actually stops the already-sent link from working — a status change
    // on this table alone is metadata only, the person could still click
    // the email they already have.
    await getSupabaseAdmin()
      .auth.admin.deleteUser(row.invited_auth_user_id)
      .catch(() => {});
  }
  await pool.query(`update core.invitation set status = 'revoked', revoked_at = now() where invitation_id = $1`, [invitationId]);
}

export async function resendInvitation(ctx: InvitationContext, invitationId: string): Promise<void> {
  const row = await getInvitationScoped(ctx, invitationId);
  if (row.status !== "pending") {
    throw new AppError(409, "INVALID_STATE_TRANSITION", `Cannot resend an invitation with status '${row.status}'.`);
  }
  const msSinceLastSend = Date.now() - new Date(row.last_sent_at).getTime();
  if (msSinceLastSend < RESEND_COOLDOWN_MS) {
    throw new AppError(429, "RESEND_COOLDOWN", `Please wait ${Math.ceil((RESEND_COOLDOWN_MS - msSinceLastSend) / 1000)}s before resending.`);
  }
  if (row.resend_count >= MAX_RESENDS) {
    throw new AppError(429, "RESEND_LIMIT_REACHED", "This invitation has already been resent the maximum number of times.");
  }

  const { error } = await getSupabaseAdmin().auth.admin.inviteUserByEmail(row.email, { data: { invited_role: row.role_code } });
  if (error) {
    throw new AppError(502, "INVITE_SEND_FAILED", error.message);
  }
  await pool.query(`update core.invitation set resend_count = resend_count + 1, last_sent_at = now() where invitation_id = $1`, [invitationId]);
}
