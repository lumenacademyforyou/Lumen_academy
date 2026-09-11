import { Request, Response, NextFunction } from "express";
import { touchActivity, revokeSession } from "../services/session.service.js";
import { pool } from "../../../db/shared/pool.js";

// LA-APP-COMPLETION-001 Phase E — thin HTTP surface over session.service.ts.
// requireAuth already resolved+validated req.sessionInfo before any of these
// run (it's mounted ahead of every route below), so these never re-derive it.

// GET /auth/session — read-only status snapshot the frontend polls to drive
// its idle-warning countdown. Deliberately does NOT touch last_activity_at
// (see session.service.ts's checkAndTouchOnAuth comment) — polling this must
// never itself keep an idle session alive, or the warning could never fire.
export async function getSessionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const nowRes = await pool.query<{ now: string }>("select now() as now");
    res.json({ data: { ...req.sessionInfo, serverNow: nowRes.rows[0].now } });
  } catch (err) {
    next(err);
  }
}

// POST /auth/session/heartbeat — explicit "the user is still here" signal.
// The frontend calls this from real activity listeners (throttled
// client-side), never from the status-polling above, so idle time only ever
// resets on genuine activity.
export async function heartbeat(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await touchActivity(req.sessionInfo!.sessionId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// POST /auth/session/logout — explicit server-side revoke, called alongside
// supabase.auth.signOut() for both a manual sign-out and a forced
// idle/absolute logout, so the local session row always reflects reality
// (E3: "an expired token must be rejected by the API, not merely hidden by
// the UI" — this is what makes that true even before the token's own,
// much-longer Supabase expiry would otherwise still accept it).
export async function logoutSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const reason = typeof req.body?.reason === "string" && req.body.reason.length > 0 ? req.body.reason : "user_logout";
    await revokeSession(req.sessionInfo!.sessionId, reason);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
