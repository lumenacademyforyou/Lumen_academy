import type { NextFunction, Request, RequestHandler, Response } from "express";
import { pool } from "../../db/shared/pool.js";
import { roleSetHasPermission } from "../lib/permissions.js";
import { AppError } from "./errorHandler.js";

// The single permission-checking middleware every protected route uses
// (LA-BE-CORE-002 CL-P6 task 2) — reads the caller's *active* roles from
// core.user_role_assignment, per migration 009_core_rbac.sql's own stated
// intent ("the backend requirePermission middleware ... reads
// user_role_assignment, never [the denormalized user_role column]"). Must
// run after requireAuth (needs req.user.appUserId).
export function requirePermission(permissionCode: string): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const appUserId = req.user?.appUserId;
      if (!appUserId) {
        next(new AppError(401, "UNAUTHORIZED", "Authentication required."));
        return;
      }

      const roles = await pool.query<{ role_code: string }>(
        `select r.role_code
           from core.user_role_assignment ura
           join core.role r on r.role_id = ura.role_id
          where ura.user_id = $1 and ura.revoked_at is null`,
        [appUserId]
      );
      const roleCodes = roles.rows.map((r) => r.role_code);

      const allowed = await roleSetHasPermission(roleCodes, permissionCode);
      if (!allowed) {
        next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action."));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
