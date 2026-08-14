import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, withErrorHandling } from "@/lib/auth/require-auth";
import { autosaveAnswer } from "@/lib/services/attempt-service";

const autosaveBody = z.object({
  chosenOptionIds: z.array(z.string().uuid()).optional(),
  chosenNumericalAnswer: z.number().nullable().optional(),
  chosenInteractionAnswer: z.unknown().optional(),
  flagged: z.boolean().optional(),
  timeSpentDeltaMs: z.number().int().min(0).max(60_000).optional(),
});

export const PATCH = withErrorHandling(
  async (
    req: NextRequest,
    { params }: { params: { attemptId: string; questionId: string } }
  ) => {
    const { user } = await requireAuth(req);
    const body = autosaveBody.parse(await req.json());

    const updated = await autosaveAnswer(
      user.id,
      params.attemptId,
      params.questionId,
      body
    );

    return NextResponse.json({
      questionId: updated.questionId,
      flagged: updated.flagged,
      timeSpentMs: updated.timeSpentMs,
      savedAt: new Date().toISOString(),
    });
  }
);
