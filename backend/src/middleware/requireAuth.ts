import type { NextFunction, Request, RequestHandler, Response } from "express";
import { provisionCanonicalUser } from "../services/provisionUser.service.js";
import { supabaseAuth } from "../lib/supabaseClient.js";
import { AppError } from "./errorHandler.js";
import { checkAndTouchOnAuth, decodeSessionId, type SessionInfo } from "../services/session.service.js";
import { enforceAttemptLockdown } from "./attemptLockdown.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      // id/role: Prisma public.users (existing profile system, unaffected).
      // appUserId: core.app_user.user_id — the id every db/ repository FK
      // actually expects. Deliberately a different id from `id` above; see
      // db/core/institution/app_user/ensure-app-user.ts's header for why.
      user?: { id: string; role: string; appUserId: string };
      // The raw bearer token, kept around for callers that need to inspect
      // the token's own claims (e.g. deleteAccount.service.ts checking amr
      // for a recent OTP reauthentication) rather than just the user it
      // resolves to.
      accessToken?: string;
      // Phase E (session management) — the app-level session row backing
      // idle-timeout/absolute-cap enforcement, resolved once per request
      // here so /auth/session/* routes don't need a second query.
      sessionInfo?: SessionInfo;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
    return;
  }

  // Delegates verification to Supabase itself rather than checking a local
  // signing secret — works the same whether the project signs tokens with a
  // legacy shared secret or newer asymmetric keys.
  const { data, error } = await supabaseAuth.auth.getUser(token);
  if (error || !data.user) {
    next(new AppError(401, "UNAUTHORIZED", "Invalid or expired access token."));
    return;
  }

  try {
    const tokenPayload = {
      sub: data.user.id,
      email: data.user.email,
      phone: data.user.phone,
      user_metadata: data.user.user_metadata,
    };
    const { profile, appUserId } = await provisionCanonicalUser(tokenPayload);
    req.user = { id: profile.id, role: profile.role, appUserId };
    req.accessToken = token;

    // Phase E: Supabase's own verification above only proves the token is
    // currently valid per Supabase — it has no idea about this app's
    // 30-min-idle / 12h-absolute policy. checkAndTouchOnAuth throws 401
    // SESSION_EXPIRED if that local policy has lapsed, independent of the
    // Supabase token's own (much longer) expiry.
    const sessionId = decodeSessionId(token, data.user.id);
    req.sessionInfo = await checkAndTouchOnAuth(sessionId, appUserId);

    // Test-layer hardening B8: folded into requireAuth itself, rather than
    // added piecemeal to each of the several routers that call it (some
    // router-wide, some per-route, in inconsistent array-literal patterns
    // across catalog/content/admin/learn routes) — this is the one place
    // every authenticated request in the app already passes through, so
    // it's the one place this can be enforced without risking a router
    // that quietly never gets the check. enforceAttemptLockdown's own
    // allowlist exempts the /assess/attempts/* paths this same requireAuth
    // call gates too, so a test's own attempt calls are unaffected.
    await enforceAttemptLockdown(req, _res, next);
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new AppError(403, "FORBIDDEN", "You do not have access to this resource."));
      return;
    }
    next();
  };
}
