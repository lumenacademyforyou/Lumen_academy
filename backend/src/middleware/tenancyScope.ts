import type { NextFunction, Request, RequestHandler, Response } from "express";
import { pool } from "../../../db/shared/pool.js";
import { AppError } from "./errorHandler.js";

// Tenancy scoping helpers (LA-BE-CORE-002 CL-P6 task 3). Three scopes:
//
//   - platform scope: no institution restriction at all. A super_admin or
//     platform_admin acting platform-wide needs no helper here — the
//     absence of an institution check *is* platform scope. Nothing to
//     export for it; routes for CL-P7's platform-wide admin actions simply
//     don't call requireOwnInstitution.
//   - institution scope: the caller may only act on rows belonging to their
//     own core.app_user.institution_id. requireOwnInstitution below.
//   - self scope: the caller may only act on their own row. Already built
//     and in use — backend/lib/dbCrudRouter.ts's makeOwnedCrudRouter. Not
//     duplicated here.
//
// Not wired into any route yet: every existing protected endpoint is either
// platform-scoped (catalog, gated by permission alone) or self-scoped
// (assess/learn, via makeOwnedCrudRouter). No institution-scoped admin
// endpoint exists to attach this to — that's CL-P7's user-lifecycle-
// administration surface (list/manage users within one's own institution).
// Built and tested now so CL-P7 has it ready rather than reinventing it
// under a later phase's time pressure.

// Resolves the caller's own institution_id (null for platform-scoped roles
// with no institution, e.g. a self-registered student or a platform admin).
export async function getCallerInstitutionId(appUserId: string): Promise<string | null> {
  const res = await pool.query<{ institution_id: string | null }>(`select institution_id from core.app_user where user_id = $1`, [appUserId]);
  if (res.rowCount === 0) throw new AppError(404, "USER_NOT_FOUND", "User not found.");
  return res.rows[0].institution_id;
}

// Middleware factory: refuses (404, matching makeOwnedCrudRouter's own
// reasoning — a row outside your scope shouldn't be distinguishable from a
// row that doesn't exist) unless the target resource's institution_id
// matches the caller's own. `resolveTargetInstitutionId` is supplied by the
// route, since which table/column holds the target's institution_id differs
// per resource (core.batch.institution_id directly; a student's via
// core.app_user.institution_id; etc.) — this middleware only owns the
// comparison, not how to look the value up.
export function requireOwnInstitution(resolveTargetInstitutionId: (req: Request) => Promise<string | null>): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const appUserId = req.user?.appUserId;
      if (!appUserId) {
        next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
        return;
      }
      const [callerInstitutionId, targetInstitutionId] = await Promise.all([
        getCallerInstitutionId(appUserId),
        resolveTargetInstitutionId(req),
      ]);
      if (callerInstitutionId === null || targetInstitutionId === null || callerInstitutionId !== targetInstitutionId) {
        next(new AppError(404, "NOT_FOUND", "Resource not found."));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
