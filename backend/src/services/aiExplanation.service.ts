import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { AppError } from "../middleware/errorHandler.js";
import { getAIProvider } from "./ai/index.js";
import { EXPLAIN_WRONG_ANSWER_PROMPT_VERSION, explainWrongAnswer_v1 } from "./ai/prompts/explainWrongAnswer.js";

const DAILY_EXPLAIN_LIMIT_PER_USER = 20;

const explainResponseSchema = z.object({
  whyWrong: z.string().min(1),
  whyCorrect: z.string().min(1),
  keyConcept: z.string().min(1),
  commonMistake: z.string().min(1),
});

export type ExplainResult =
  | { source: "written"; explanation: string }
  | ({ source: "cache" | "ai" } & z.infer<typeof explainResponseSchema>)
  | { source: "unavailable"; message: string };

function hashCacheKey(parts: string[]): string {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

async function logUsage(params: {
  userId: string;
  provider: string;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  latencyMs: number;
  cacheHit: boolean;
  errorCode: string | null;
}): Promise<void> {
  await prisma.aiUsage.create({
    data: {
      userId: params.userId,
      endpoint: "ai.explain",
      provider: params.provider,
      model: params.model,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      latencyMs: params.latencyMs,
      cacheHit: params.cacheHit,
      errorCode: params.errorCode,
    },
  });
}

export async function explainWrongAnswer(userId: string, attemptId: string, questionId: string): Promise<ExplainResult> {
  const answer = await prisma.attemptAnswer.findUnique({
    where: { attemptId_questionId: { attemptId, questionId } },
    include: {
      attempt: true,
      question: { include: { options: true } },
      selectedOption: true,
    },
  });

  if (!answer || answer.attempt.userId !== userId) {
    throw new AppError(404, "ANSWER_NOT_FOUND", "No matching answer was found for this attempt.");
  }

  if (answer.attempt.status !== "submitted" && answer.attempt.status !== "expired") {
    throw new AppError(409, "ATTEMPT_NOT_FINISHED", "Explanations are only available after the attempt is submitted.");
  }

  const question = answer.question;

  // 1. A written explanation on the question needs no AI call at all.
  if (question.explanationEn) {
    return { source: "written", explanation: question.explanationEn };
  }

  const selectedOption = answer.selectedOption;
  const correctOption = question.options.find((option) => option.isCorrect);

  if (!selectedOption || !correctOption) {
    throw new AppError(400, "EXPLAIN_NOT_APPLICABLE", "This question was skipped and has no selection to explain.");
  }

  const locale: "en" | "ta" = "en";
  const cacheKey = hashCacheKey([EXPLAIN_WRONG_ANSWER_PROMPT_VERSION, questionId, selectedOption.id, locale]);

  // 2. Cache hit.
  const cached = await prisma.aiCache.findUnique({ where: { cacheKey } });
  if (cached) {
    await prisma.aiCache.update({ where: { cacheKey }, data: { hitCount: { increment: 1 } } });
    await logUsage({
      userId,
      provider: cached.provider,
      model: cached.model,
      tokensIn: null,
      tokensOut: null,
      latencyMs: 0,
      cacheHit: true,
      errorCode: null,
    });
    const parsed = explainResponseSchema.parse(cached.responseJson);
    return { source: "cache", ...parsed };
  }

  // 3. Daily per-user limit (only counts real, non-cached calls).
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todaysCallCount = await prisma.aiUsage.count({
    where: { userId, endpoint: "ai.explain", cacheHit: false, createdAt: { gte: startOfDay } },
  });
  if (todaysCallCount >= DAILY_EXPLAIN_LIMIT_PER_USER) {
    throw new AppError(429, "DAILY_LIMIT_EXCEEDED", "You've reached today's explanation limit. Please try again tomorrow.");
  }

  // 4. Call the provider.
  const provider = getAIProvider();
  const request = explainWrongAnswer_v1({
    questionStem: question.stemEn,
    selectedOptionText: selectedOption.textEn,
    correctOptionText: correctOption.textEn,
    locale,
  });

  const startedAt = Date.now();
  try {
    const completion = await provider.complete(request);
    const validated = explainResponseSchema.parse(JSON.parse(completion.text));
    const latencyMs = Date.now() - startedAt;

    await prisma.aiCache.create({
      data: {
        cacheKey,
        responseJson: validated,
        promptVersion: EXPLAIN_WRONG_ANSWER_PROMPT_VERSION,
        provider: provider.name,
        model: completion.model,
      },
    });

    await logUsage({
      userId,
      provider: provider.name,
      model: completion.model,
      tokensIn: completion.tokensIn,
      tokensOut: completion.tokensOut,
      latencyMs,
      cacheHit: false,
      errorCode: null,
    });

    return { source: "ai", ...validated };
  } catch (err) {
    // 5. A provider failure must never break the result screen.
    const latencyMs = Date.now() - startedAt;
    console.error("AI explanation provider failed:", err);
    await logUsage({
      userId,
      provider: provider.name,
      model: null,
      tokensIn: null,
      tokensOut: null,
      latencyMs,
      cacheHit: false,
      errorCode: "PROVIDER_ERROR",
    });
    return { source: "unavailable", message: "AI explanations are temporarily unavailable. Please try again later." };
  }
}
