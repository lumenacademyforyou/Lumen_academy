import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth, withErrorHandling } from "@/lib/auth/require-auth";
import { getReviewQueue } from "@/lib/services/question-review-service";

const REVIEWER_ROLES = [Role.FACULTY, Role.ADMIN];

export const GET = withErrorHandling(async (req: NextRequest) => {
  const { user } = await requireAuth(req, { role: REVIEWER_ROLES });
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

  const queue = await getReviewQueue(user.id, limit);
  return NextResponse.json(queue);
});
