import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth, withErrorHandling } from "@/lib/auth/require-auth";
import { publishQuestion } from "@/lib/services/question-review-service";

const REVIEWER_ROLES = [Role.FACULTY, Role.ADMIN];

const publishBody = z.object({
  reviewNotes: z.string().max(2000).optional(),
});

export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: { questionId: string } }) => {
    const { user } = await requireAuth(req, { role: REVIEWER_ROLES });
    const body = publishBody.parse(await req.json().catch(() => ({})));

    const published = await publishQuestion(user.id, params.questionId, body.reviewNotes);
    return NextResponse.json(published);
  }
);
