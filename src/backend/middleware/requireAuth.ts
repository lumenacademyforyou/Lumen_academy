import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ensureUserProfile } from "../services/userProfile.service.js";
import { supabaseAuth } from "../supabaseClient.js";
import { AppError } from "./errorHandler.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: string };
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
    const profile = await ensureUserProfile({
      sub: data.user.id,
      email: data.user.email,
      phone: data.user.phone,
      user_metadata: data.user.user_metadata,
    });
    req.user = { id: profile.id, role: profile.role };
    next();
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
