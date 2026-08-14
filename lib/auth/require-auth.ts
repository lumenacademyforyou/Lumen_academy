// lib/auth/require-auth.ts
//
// The one place that turns "a Supabase session" into "an app User row you
// can trust". Every other service in this codebase (attempt-service,
// question-review-service, ...) assumes the userId it receives has already
// passed through here — none of them re-verify the session themselves.
//
// Two responsibilities, deliberately kept together:
//   1. Verify the request actually carries a valid Supabase session.
//   2. Lazily create the app-side `User` row on first sight, per the
//      schema's comment: "created lazily on a user's first authenticated
//      request... It never stores a credential."
//
// Usage in a Next.js App Router route handler:
//
//   export async function POST(req: NextRequest) {
//     const { user } = await requireAuth(req);
//     const attempt = await startAttempt(user.id, testId);
//     return NextResponse.json(attempt);
//   }
//
// Usage for role-gated routes (question review, publish):
//
//   const { user } = await requireAuth(req, { role: ["FACULTY", "ADMIN"] });

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export class UnauthenticatedError extends Error {
  status = 401;
}
export class ForbiddenRoleError extends Error {
  status = 403;
}

type RequireAuthOptions = {
  // If set, the caller's User.role must be one of these, or the request
  // is rejected before it ever reaches a service function. Role changes
  // (e.g. promoting someone to FACULTY) take effect on their next request
  // — there's no session-side caching of role to invalidate.
  role?: Role[];
};

export async function requireAuth(req: NextRequest, options: RequireAuthOptions = {}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        // Read-only here — this middleware never needs to set/refresh
        // cookies itself; that's handled by the Supabase auth callback route.
        getAll: () => req.cookies.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser();

  if (error || !authUser) {
    throw new UnauthenticatedError("No valid session");
  }

  // Lazy create-or-fetch. Uses the Supabase auth user id as the primary
  // key directly (schema: "id String @id // == Supabase auth.users.id"),
  // so there's no separate mapping table to keep in sync.
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    update: {}, // existing user — don't overwrite role/profile fields here
    create: {
      id: authUser.id,
      email: authUser.email ?? null,
      phone: authUser.phone ?? null,
      // passwordHash intentionally never set — Supabase Auth owns credentials.
    },
  });

  if (user.deletedAt) {
    throw new UnauthenticatedError("Account has been deleted");
  }

  if (options.role && !options.role.includes(user.role)) {
    throw new ForbiddenRoleError(
      `Requires role ${options.role.join(" or ")}, has ${user.role}`
    );
  }

  return { user, supabaseUser: authUser };
}

// ─────────────────────────────────────────────────────────────────────────
// Route wrapper — catches the two error types above and the service-layer
// errors from attempt-service / question-review-service, and turns them
// into consistent HTTP responses instead of every route handler doing its
// own try/catch.
// ─────────────────────────────────────────────────────────────────────────

const STATUS_BY_ERROR_NAME: Record<string, number> = {
  UnauthenticatedError: 401,
  ForbiddenRoleError: 403,
  ForbiddenError: 403, // from question-review-service / attempt-service
  NotFoundError: 404,
  AttemptClosedError: 409,
  DeadlinePassedError: 409,
  ValidationError: 422,
};

export function withErrorHandling<Args extends any[] = [req: NextRequest, ...args: any[]]>(
  handler: (...args: any[]) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      const name = (err as Error)?.constructor?.name ?? "Error";
      const status = STATUS_BY_ERROR_NAME[name] ?? 500;
      const message = (err as Error)?.message ?? "Internal error";
      const issues = (err as { issues?: string[] })?.issues;

      if (status === 500) {
        // Anything unmapped is a bug, not a client error — log it loudly.
        console.error("Unhandled error in route handler:", err);
      }

      return NextResponse.json(
        { error: message, ...(issues?.length ? { issues } : {}) },
        { status }
      );
    }
  };
}
