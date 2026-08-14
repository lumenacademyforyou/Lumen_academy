import { NextRequest, NextResponse } from "next/server";
import { requireAuth, withErrorHandling } from "@/lib/auth/require-auth";
import { submitAttempt } from "@/lib/services/attempt-service";

export const POST = withErrorHandling(
  async (req: NextRequest, { params }: { params: { attemptId: string } }) => {
    const { user } = await requireAuth(req);

    const result = await submitAttempt(user.id, params.attemptId);

    return NextResponse.json({
      status: result.status,
      score: result.score,
      maxScore: result.maxScore,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      skippedCount: result.skippedCount,
      accuracy: result.accuracy,
      submittedAt: result.submittedAt,
    });
  }
);
