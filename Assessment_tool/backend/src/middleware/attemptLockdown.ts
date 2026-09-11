import type { NextFunction, Request, Response } from "express";
import { AppError } from "./errorHandler.js";
import { pool } from "../../../db/shared/pool.js";

/**
 * Test-layer hardening B8 (docs/test-layer-hardening-prompt.md,
 * docs/BUGS.md#B8, docs/AUDIT.md §1.3). Confirmed live that nothing on the
 * server ever rejected a call to an unrelated endpoint (dashboard,
 * catalog, content, admin...) just because the caller had an attempt
 * `in_progress` — every lockdown mechanism this app has (B1-B7) is
 * client-side UX, easily bypassed by a direct API call. This is the one
 * server-side enforcement point.
 *
 * Allowlist, not blocklist, per the audit's own framing: `TestTakingView`
 * (the only screen mounted while an attempt is in progress — it renders
 * standalone outside the Header/app shell, confirmed by the earlier
 * BUG-09 work) only ever calls the /assess/attempts/:id/* endpoints
 * (envelope, responses, submit, pause, events — see
 * frontend/src/services/sessionApi.ts). Nothing else needs to reach the
 * server while a test is running, so everything else is rejected instead
 * of trying to enumerate every endpoint that's merely "probably fine."
 *
 * Deliberately scoped to `in_progress` only, not `paused`: pausing (Exit &
 * Pause) is this app's own sanctioned "leave the test and browse
 * elsewhere" mechanism — locking down navigation for a paused attempt
 * would break that flow, not protect it.
 *
 * Mounted globally, after requireAuth, before the route table in api.ts —
 * one query per authenticated request. Deliberately not cached: an
 * attempt's state can change (submit, pause, expiry-sweep) between
 * requests, and this check exists specifically to be authoritative at
 * request time, not eventually-consistent.
 */
// Matched against req.originalUrl (the /api-prefixed full request path),
// not req.path — this runs from inside requireAuth, which is itself
// mounted at varying nesting depths across different routers (some
// router-wide via `.use(requireAuth)`, some per-route), so req.path alone
// would be relative to whichever sub-router happens to be active and
// wouldn't reliably include the /assess/attempts segment.
// Found live while chasing a "can't resume the paused test" report: a demo
// account left with a genuinely stuck in_progress attempt (e.g. a crashed
// tab, or an automated test run that didn't reach its own cleanup) could
// never recover, because /api/auth/demo/reset — the one endpoint whose
// entire purpose is wiping the account back to a clean state — wasn't
// allowlisted either, so it 423'd on exactly the state it exists to clear.
// A recovery mechanism that the lockdown it's meant to recover from can
// itself block is a deadlock, not a protection.
const ALLOWED_PATH_PREFIXES = ["/api/assess/attempts", "/api/auth/session", "/api/auth/demo", "/api/health"];

export async function enforceAttemptLockdown(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next();
    return;
  }
  if (ALLOWED_PATH_PREFIXES.some((prefix) => req.originalUrl.startsWith(prefix))) {
    next();
    return;
  }

  try {
    const res = await pool.query<{ attempt_id: string }>(
      `select attempt_id from assess.attempt where user_id = $1 and attempt_state = 'in_progress' limit 1`,
      [req.user.appUserId]
    );
    if (res.rowCount && res.rowCount > 0) {
      next(
        new AppError(
          423,
          "ATTEMPT_LOCKDOWN_ACTIVE",
          "You have a test in progress. Submit or exit it before using other parts of the app."
        )
      );
      return;
    }
    next();
  } catch (err) {
    // A failure to check lockdown status must never itself block the
    // entire app — fail open, same discipline as every other best-effort
    // guard in this codebase (e.g. handleExitAndPause's pause-call catch).
    next();
  }
}
