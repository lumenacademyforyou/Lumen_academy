import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, withErrorHandling } from "@/lib/auth/require-auth";
import { startAttempt } from "@/lib/services/attempt-service";

const startAttemptBody = z.object({
  testId: z.string().uuid(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { user } = await requireAuth(req);
  const body = startAttemptBody.parse(await req.json());

  const attempt = await startAttempt(user.id, body.testId);

  // 201, and never echo back anything answer-bearing — startAttempt's
  // return value only ever contains the Attempt row itself (timing/status),
  // not AttemptQuestion content. The client fetches the paper separately
  // via GET /api/attempts/:id (not shown) which reads contentSnapshot only.
  return NextResponse.json(attempt, { status: 201 });
});
