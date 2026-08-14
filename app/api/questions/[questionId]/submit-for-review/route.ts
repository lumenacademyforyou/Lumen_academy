import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandling } from "@/lib/auth/require-auth";
import { submitForReview } from "@/lib/services/question-review-service";

export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: { questionId: string } }) => {
    await requireAuth(req);
    const updated = await submitForReview(params.questionId);
    return NextResponse.json(updated);
  }
);
