import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth, withErrorHandling } from "@/lib/auth/require-auth";
import { rejectQuestion } from "@/lib/services/question-review-service";

const REVIEWER_ROLES = [Role.FACULTY, Role.ADMIN];

const rejectBody = z.object({
  reviewNotes: z.string().min(1).max(2000),
});

export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: { questionId: string } }) => {
    const { user } = await requireAuth(req, { role: REVIEWER_ROLES });
    const body = rejectBody.parse(await req.json());

    const rejected = await rejectQuestion(user.id, params.questionId, body.reviewNotes);
    return NextResponse.json(rejected);
  }
);
