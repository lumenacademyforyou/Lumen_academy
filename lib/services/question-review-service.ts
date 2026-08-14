// lib/services/question-review-service.ts
//
// The gate between question authoring (human or AI) and a student ever
// seeing a question. Enforces:
//   - Only FACULTY/ADMIN can move a question out of DRAFT/PENDING_REVIEW.
//   - interactionConfig/scoringConfig are structurally valid for their
//     QuestionType before publish — a malformed config must never reach
//     a live test.
//   - Correct-option count matches QuestionType (1 for SINGLE_CORRECT, 1+
//     for MULTIPLE_CORRECT, 0 for NUMERICAL/MATCHING/ASSERTION_REASON,
//     which grade off Question fields or scoringConfig instead).
//   - contentHash catches exact duplicates before publish; near-duplicates
//     are expected to have already been screened in the offline generation
//     pipeline's own embedding store, per the schema's design note.
//   - Every publish/reject is attributable — reviewedById + reviewedAt is
//     never optional once a decision is made.

import { PrismaClient, QStatus, QuestionType, Role } from "@prisma/client";
import { createHash } from "crypto";
import { z } from "zod";

const prisma = new PrismaClient();

export class ForbiddenError extends Error {}
export class NotFoundError extends Error {}
export class ValidationError extends Error {
  constructor(message: string, public issues: string[]) {
    super(message);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// scoringConfig / interactionConfig shapes, by QuestionType.
// Adjust these to match your actual contract — this is the enforcement
// point, so it's deliberately strict rather than permissive.
// ─────────────────────────────────────────────────────────────────────────

const matchingInteractionConfig = z.object({
  leftItems: z.array(z.object({ id: z.string(), textEn: z.string() })).min(2),
  rightItems: z.array(z.object({ id: z.string(), textEn: z.string() })).min(2),
});

const matchingScoringConfig = z.object({
  correctMapping: z.record(z.string(), z.string()), // leftItemId -> rightItemId
});

const assertionReasonInteractionConfig = z.object({
  assertionEn: z.string().min(1),
  reasonEn: z.string().min(1),
});

const assertionReasonScoringConfig = z.object({
  correctChoice: z.enum([
    "BOTH_TRUE_REASON_EXPLAINS",
    "BOTH_TRUE_REASON_DOES_NOT_EXPLAIN",
    "ASSERTION_TRUE_REASON_FALSE",
    "ASSERTION_FALSE_REASON_TRUE",
    "BOTH_FALSE",
  ]),
});

// ─────────────────────────────────────────────────────────────────────────
// requireReviewer — shared guard for every mutating function below.
// ─────────────────────────────────────────────────────────────────────────

async function requireReviewer(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError("User not found");
  if (user.role !== Role.FACULTY && user.role !== Role.ADMIN) {
    throw new ForbiddenError("Only faculty or admin can review questions");
  }
  return user;
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT FOR REVIEW — author (human or the AI worker acting as a service
// account) moves a question from DRAFT into the queue. No role check here;
// this is the low-stakes side of the gate.
// ─────────────────────────────────────────────────────────────────────────

export async function submitForReview(questionId: string) {
  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new NotFoundError("Question not found");
  if (question.status !== QStatus.DRAFT) {
    throw new ValidationError("Only a DRAFT question can be submitted for review", []);
  }

  return prisma.question.update({
    where: { id: questionId },
    data: { status: QStatus.PENDING_REVIEW },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// VALIDATE — structural checks run before either publish or reject-on-fail.
// Returns the list of issues rather than throwing, so the reviewer UI can
// show all of them at once instead of one at a time.
// ─────────────────────────────────────────────────────────────────────────

function validateQuestion(
  question: Awaited<ReturnType<typeof loadForReview>>
): string[] {
  const issues: string[] = [];

  if (!question.stemEn?.trim()) issues.push("stemEn is empty");
  if (question.marks <= 0) issues.push("marks must be positive");
  if (question.negativeMarks < 0) issues.push("negativeMarks cannot be negative");
  if (question.examTypes.length === 0) issues.push("no examTypes set");

  switch (question.type) {
    case QuestionType.SINGLE_CORRECT: {
      const correct = question.options.filter((o) => o.isCorrect);
      if (question.options.length < 2) issues.push("needs at least 2 options");
      if (correct.length !== 1)
        issues.push(`SINGLE_CORRECT must have exactly 1 correct option, has ${correct.length}`);
      break;
    }
    case QuestionType.MULTIPLE_CORRECT: {
      const correct = question.options.filter((o) => o.isCorrect);
      if (question.options.length < 2) issues.push("needs at least 2 options");
      if (correct.length < 1)
        issues.push("MULTIPLE_CORRECT must have at least 1 correct option");
      break;
    }
    case QuestionType.NUMERICAL: {
      if (question.numericalAnswer == null) issues.push("numericalAnswer is required");
      if (question.numericalTolerance == null)
        issues.push("numericalTolerance is required");
      if (question.options.length > 0)
        issues.push("NUMERICAL questions should not have Option rows");
      break;
    }
    case QuestionType.MATCHING: {
      const ic = matchingInteractionConfig.safeParse(question.interactionConfig);
      if (!ic.success) issues.push(`interactionConfig invalid: ${ic.error.message}`);
      const sc = matchingScoringConfig.safeParse(question.scoringConfig);
      if (!sc.success) issues.push(`scoringConfig invalid: ${sc.error.message}`);
      break;
    }
    case QuestionType.ASSERTION_REASON: {
      const ic = assertionReasonInteractionConfig.safeParse(question.interactionConfig);
      if (!ic.success) issues.push(`interactionConfig invalid: ${ic.error.message}`);
      const sc = assertionReasonScoringConfig.safeParse(question.scoringConfig);
      if (!sc.success) issues.push(`scoringConfig invalid: ${sc.error.message}`);
      break;
    }
  }

  return issues;
}

function loadForReview(questionId: string) {
  return prisma.question.findUniqueOrThrow({
    where: { id: questionId },
    include: { options: true },
  });
}

// Canonicalize before hashing so formatting-only diffs (whitespace, option
// order) don't produce a different hash for the same underlying question.
function computeContentHash(question: {
  type: string;
  stemEn: string;
  options: { textEn: string; isCorrect: boolean }[];
  numericalAnswer: unknown;
}) {
  const canonical = JSON.stringify({
    type: question.type,
    stem: question.stemEn.trim().toLowerCase().replace(/\s+/g, " "),
    options: [...question.options]
      .map((o) => `${o.textEn.trim().toLowerCase()}:${o.isCorrect}`)
      .sort(),
    numericalAnswer: question.numericalAnswer,
  });
  return createHash("sha256").update(canonical).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────
// PUBLISH — the actual gate. PENDING_REVIEW → PUBLISHED only.
// ─────────────────────────────────────────────────────────────────────────

export async function publishQuestion(
  reviewerId: string,
  questionId: string,
  reviewNotes?: string
) {
  await requireReviewer(reviewerId);

  const question = await loadForReview(questionId);
  if (question.status !== QStatus.PENDING_REVIEW) {
    throw new ValidationError(
      `Cannot publish a question in status ${question.status}`,
      []
    );
  }

  const issues = validateQuestion(question);
  if (issues.length > 0) {
    throw new ValidationError("Question failed validation", issues);
  }

  const contentHash = computeContentHash(question);
  const duplicate = await prisma.question.findFirst({
    where: { contentHash, id: { not: questionId }, status: QStatus.PUBLISHED },
  });
  if (duplicate) {
    throw new ValidationError(
      `Exact duplicate of already-published question ${duplicate.id}`,
      []
    );
  }

  return prisma.question.update({
    where: { id: questionId },
    data: {
      status: QStatus.PUBLISHED,
      publishedAt: new Date(),
      contentHash,
      selectionBucket: Math.floor(Math.random() * 1000),
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes ?? null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// REJECT — kept for the audit trail, per QStatus.REJECTED's comment in the
// schema. reviewNotes is required here, unlike publish, since a rejection
// without a reason isn't actionable for whoever authored the question.
// ─────────────────────────────────────────────────────────────────────────

export async function rejectQuestion(
  reviewerId: string,
  questionId: string,
  reviewNotes: string
) {
  await requireReviewer(reviewerId);
  if (!reviewNotes?.trim()) {
    throw new ValidationError("reviewNotes is required to reject a question", []);
  }

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new NotFoundError("Question not found");
  if (question.status !== QStatus.PENDING_REVIEW) {
    throw new ValidationError(
      `Cannot reject a question in status ${question.status}`,
      []
    );
  }

  return prisma.question.update({
    where: { id: questionId },
    data: {
      status: QStatus.REJECTED,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      reviewNotes,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// RETIRE — PUBLISHED → RETIRED. Never a hard delete once a question has
// attempts, per the schema's comment on Question.id being immutable forever.
// ─────────────────────────────────────────────────────────────────────────

export async function retireQuestion(reviewerId: string, questionId: string) {
  await requireReviewer(reviewerId);

  const question = await prisma.question.findUnique({ where: { id: questionId } });
  if (!question) throw new NotFoundError("Question not found");
  if (question.status !== QStatus.PUBLISHED) {
    throw new ValidationError(
      `Cannot retire a question in status ${question.status}`,
      []
    );
  }

  return prisma.question.update({
    where: { id: questionId },
    data: { status: QStatus.RETIRED, retiredAt: new Date() },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// REVIEW QUEUE — "items awaiting me", backed by the
// @@index([status, reviewedById]) index in the schema.
// ─────────────────────────────────────────────────────────────────────────

export async function getReviewQueue(reviewerId: string, limit = 20) {
  await requireReviewer(reviewerId);
  return prisma.question.findMany({
    where: { status: QStatus.PENDING_REVIEW },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { options: true, subject: true, unit: true, topic: true },
  });
}
