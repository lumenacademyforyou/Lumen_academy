import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { requireAuth, withErrorHandling } from "@/lib/auth/require-auth";
import { retireQuestion } from "@/lib/services/question-review-service";

const REVIEWER_ROLES = [Role.FACULTY, Role.ADMIN];

export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: { questionId: string } }) => {
    const { user } = await requireAuth(req, { role: REVIEWER_ROLES });
    const retired = await retireQuestion(user.id, params.questionId);
    return NextResponse.json(retired);
  }
);
