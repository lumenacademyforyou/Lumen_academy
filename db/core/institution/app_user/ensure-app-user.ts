import { pool } from "../../../shared/pool.js";
import type { AppUserModel } from "./app_user.model.js";

export interface SupabaseAccessTokenPayload {
  sub: string;
  email?: string;
  phone?: string;
  user_metadata?: Record<string, unknown>;
}

// Supabase's auth.users is the source of truth for identity; core.app_user
// is our own surrogate-keyed row linked to it via auth_user_id (rule R7 —
// business/external keys are never the PK). Lazily provisions a
// core.app_user row on a given account's first request that touches the new
// schema — mirrors backend/services/userProfile.service.ts's
// ensureUserProfile exactly (same fallback order for a display name), just
// against core.app_user instead of Prisma's public.users. The two are
// deliberately separate rows/tables (Prisma's user vs core.app_user) — this
// does not touch or replace the Prisma-based profile.
//
// mobile_number is nullable (007_core_mobile_nullable.sql) — real Supabase
// signups are commonly email-only. full_name falls back through metadata ->
// email prefix -> phone -> "Student", same as the Prisma path, rather than
// leaving a NOT NULL column with no real value.
//
// core.app_user.email is still NOT NULL — a phone-only signup (no email at
// all) will fail this insert with a constraint error rather than a fake
// email being invented. Not hit yet; if it comes up, that's a real decision
// to make (nullable email too?), not something to silently paper over here.
export async function ensureAppUser(payload: SupabaseAccessTokenPayload): Promise<string> {
  const existing = await pool.query<Pick<AppUserModel, "user_id">>(
    "select user_id from core.app_user where auth_user_id = $1",
    [payload.sub]
  );
  if (existing.rowCount && existing.rowCount > 0) {
    return existing.rows[0].user_id;
  }

  // Supabase's JS SDK returns "" (not null/undefined) for an unset optional
  // string like phone on a real user object — `?? null` doesn't catch that,
  // and multiple such users would collide on the partial unique index on
  // mobile_number (empty string is a real, non-null value that's equal to
  // itself). Normalize falsy-string-or-missing to null explicitly.
  const email = payload.email || null;
  const phone = payload.phone || null;

  const fullName =
    (payload.user_metadata?.display_name as string | undefined) ||
    (payload.user_metadata?.full_name as string | undefined) ||
    email?.split("@")[0] ||
    phone ||
    "Student";

  const inserted = await pool.query<Pick<AppUserModel, "user_id">>(
    `insert into core.app_user (auth_user_id, email, mobile_number, full_name, user_role, status)
     values ($1, $2, $3, $4, 'student', 'active')
     on conflict (auth_user_id) do update set auth_user_id = excluded.auth_user_id
     returning user_id`,
    [payload.sub, email, phone, fullName]
  );
  return inserted.rows[0].user_id;
}
