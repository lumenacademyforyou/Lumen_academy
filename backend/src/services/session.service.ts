import { pool } from "../../../db/shared/pool.js";
import { AppError } from "../middleware/errorHandler.js";
import { config } from "../config/env.js";

// LA-APP-COMPLETION-001 Phase E — session management + auto logout.
//
// Supabase Auth already verifies the bearer token itself
// (requireAuth.ts -> supabaseAuth.auth.getUser). This module adds the layer
// Supabase has no concept of: *this app's* idle-timeout and absolute-session
// -cap policy, backed by core.user_session (022_core_user_session.sql).
//
// Keyed by the Supabase JWT's own `session_id` claim (see decodeSessionId
// below) rather than the access token itself, so a background token refresh
// (a new access token, same underlying login) never looks like a new
// session — only a genuinely new sign-in mints a new session_id.

const IDLE_TIMEOUT_MS = config.sessionIdleTimeoutMinutes * 60 * 1000;
const ABSOLUTE_SESSION_MS = config.sessionAbsoluteHours * 60 * 60 * 1000;

/**
 * Reads the `session_id` claim out of an already-Supabase-verified access
 * token, without re-verifying the signature — safe here because this only
 * ever runs after requireAuth.ts's supabaseAuth.auth.getUser(token) call has
 * already proven the token authentic; this is purely reading another claim
 * out of the same trusted payload, not an independent trust decision.
 *
 * Falls back to the auth user id if the claim is ever absent (a defensive
 * fallback only — degrades to one tracked session per user instead of per
 * login, never crashes).
 */
export function decodeSessionId(token: string, fallbackUserId: string): string {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return fallbackUserId;
    const json = Buffer.from(payloadSegment, "base64url").toString("utf8");
    const claims = JSON.parse(json) as { session_id?: string };
    return typeof claims.session_id === "string" && claims.session_id.length > 0 ? claims.session_id : fallbackUserId;
  } catch {
    return fallbackUserId;
  }
}

export interface SessionInfo {
  sessionId: string;
  issuedAt: string;
  lastActivityAt: string;
  absoluteExpiresAt: string;
  idleTimeoutMs: number;
}

interface UserSessionRow {
  session_id: string;
  user_id: string;
  issued_at: string;
  last_activity_at: string;
  absolute_expires_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
}

/**
 * Called once per authenticated request (from requireAuth.ts). Read-mostly:
 * only writes when it's either creating the row for a session seen for the
 * first time (i.e. login), or transitioning an expired-but-not-yet-marked
 * row to revoked (the actual enforcement moment — E3: "an expired token
 * must be rejected by the API, not merely hidden by the UI"). Never touches
 * last_activity_at on the common passing path — that's heartbeat's job
 * (touchActivity below), kept separate so routine polling of session status
 * can't silently keep an idle session alive.
 *
 * @throws {AppError} 401 SESSION_EXPIRED if the session is revoked, or just
 *   found to be past its idle or absolute limit.
 */
export async function checkAndTouchOnAuth(sessionId: string, userId: string): Promise<SessionInfo> {
  const existing = await pool.query<UserSessionRow>(`select * from core.user_session where session_id = $1`, [sessionId]);

  if (existing.rowCount === 0) {
    const nowRes = await pool.query<{ now: string }>("select now() as now");
    const absoluteExpiresAt = new Date(new Date(nowRes.rows[0].now).getTime() + ABSOLUTE_SESSION_MS).toISOString();
    const inserted = await pool.query<UserSessionRow>(
      `insert into core.user_session (session_id, user_id, absolute_expires_at)
       values ($1, $2, $3)
       on conflict (session_id) do update set session_id = excluded.session_id
       returning *`,
      [sessionId, userId, absoluteExpiresAt]
    );
    const row = inserted.rows[0];
    return { sessionId: row.session_id, issuedAt: row.issued_at, lastActivityAt: row.last_activity_at, absoluteExpiresAt: row.absolute_expires_at, idleTimeoutMs: IDLE_TIMEOUT_MS };
  }

  const row = existing.rows[0];
  if (row.revoked_at) {
    throw new AppError(401, "SESSION_EXPIRED", `Your session has ended (${row.revoked_reason ?? "revoked"}). Please sign in again.`);
  }

  const nowMs = Date.now();
  if (nowMs > new Date(row.absolute_expires_at).getTime()) {
    await pool.query(`update core.user_session set revoked_at = now(), revoked_reason = 'absolute_timeout' where session_id = $1`, [sessionId]);
    throw new AppError(401, "SESSION_EXPIRED", "Your session has expired after reaching its maximum length. Please sign in again.");
  }
  if (nowMs - new Date(row.last_activity_at).getTime() > IDLE_TIMEOUT_MS) {
    await pool.query(`update core.user_session set revoked_at = now(), revoked_reason = 'idle_timeout' where session_id = $1`, [sessionId]);
    throw new AppError(401, "SESSION_EXPIRED", "You were signed out due to inactivity. Please sign in again.");
  }

  return { sessionId: row.session_id, issuedAt: row.issued_at, lastActivityAt: row.last_activity_at, absoluteExpiresAt: row.absolute_expires_at, idleTimeoutMs: IDLE_TIMEOUT_MS };
}

/** Explicit activity signal (frontend heartbeat, throttled client-side to real user activity — never called just from status polling). */
export async function touchActivity(sessionId: string): Promise<void> {
  await pool.query(`update core.user_session set last_activity_at = now() where session_id = $1 and revoked_at is null`, [sessionId]);
}

/** Explicit revoke — idle-logout, absolute-timeout, or a manual sign-out, all funnel through this so the row always reflects reality. */
export async function revokeSession(sessionId: string, reason: string): Promise<void> {
  await pool.query(`update core.user_session set revoked_at = now(), revoked_reason = $2 where session_id = $1 and revoked_at is null`, [sessionId, reason]);
}
