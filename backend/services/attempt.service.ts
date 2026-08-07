import { AppError } from "../middleware/errorHandler.js";
import { prisma } from "../db.js";
import type { QuestionModel, QuestionOptionModel } from "../generated/prisma/models.js";

const MIN_SUBMITTED_ATTEMPTS_FOR_REPEATS = 50;

export interface PublicQuestionOption {
  id: string;
  label: string;
  textEn: string;
  textTa: string | null;
}

export interface PublicQuestion {
  id: string;
  stemEn: string;
  stemTa: string | null;
  marks: number;
  negativeMarks: number;
  subject: string;
  unit: string;
  options: PublicQuestionOption[];
}

type QuestionWithOptions = QuestionModel & {
  options: QuestionOptionModel[];
  unit: { name: string; subject: { name: string } };
};

const QUESTION_WITH_OPTIONS_INCLUDE = {
  options: true,
  unit: { include: { subject: true } },
} as const;

// Explicit allowlist, mirroring publicUser() in auth.service.ts, so isCorrect
// and the explanation can never leak into a response before an attempt is
// submitted, even if the Question model grows more fields later.
export function toPublicQuestion(question: QuestionWithOptions): PublicQuestion {
  return {
    id: question.id,
    stemEn: question.stemEn,
    stemTa: question.stemTa,
    marks: question.marks,
    negativeMarks: question.negativeMarks,
    subject: question.unit.subject.name,
    unit: question.unit.name,
    options: question.options
      .slice()
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((option) => ({
        id: option.id,
        label: option.label,
        textEn: option.textEn,
        textTa: option.textTa,
      })),
  };
}

function shuffle<T>(items: T[]): T[] {
  const array = items.slice();
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

export interface CreateAttemptInput {
  subjectId?: string;
  unitId?: string;
  topicId?: string;
  count: number;
  durationSeconds: number;
}

export interface CreateAttemptResult {
  id: string;
  durationSeconds: number;
  startedAt: Date;
  requestedCount: number;
  shortfall: number;
  questions: PublicQuestion[];
}

export async function createAttempt(userId: string, input: CreateAttemptInput): Promise<CreateAttemptResult> {
  const submittedAttempts = await prisma.testAttempt.count({
    where: { userId, status: "submitted" },
  });
  const allowRepeats = submittedAttempts >= MIN_SUBMITTED_ATTEMPTS_FOR_REPEATS;

  let excludeQuestionIds: string[] = [];
  if (!allowRepeats) {
    const seen = await prisma.attemptAnswer.findMany({
      where: { attempt: { userId } },
      select: { questionId: true },
      distinct: ["questionId"],
    });
    excludeQuestionIds = seen.map((row) => row.questionId);
  }

  const candidates = await prisma.question.findMany({
    where: {
      isActive: true,
      ...(input.unitId ? { unitId: input.unitId } : {}),
      ...(input.topicId ? { topicId: input.topicId } : {}),
      ...(input.subjectId ? { unit: { subjectId: input.subjectId } } : {}),
      ...(excludeQuestionIds.length > 0 ? { id: { notIn: excludeQuestionIds } } : {}),
    },
    include: QUESTION_WITH_OPTIONS_INCLUDE,
  });

  const selected = shuffle(candidates).slice(0, input.count);
  const shortfall = Math.max(0, input.count - selected.length);

  const attempt = await prisma.testAttempt.create({
    data: {
      userId,
      config: { ...input },
      durationSeconds: input.durationSeconds,
      status: "in_progress",
    },
  });

  if (selected.length > 0) {
    await prisma.attemptAnswer.createMany({
      data: selected.map((question) => ({
        attemptId: attempt.id,
        questionId: question.id,
      })),
    });
  }

  return {
    id: attempt.id,
    durationSeconds: attempt.durationSeconds,
    startedAt: attempt.startedAt,
    requestedCount: input.count,
    shortfall,
    questions: selected.map(toPublicQuestion),
  };
}

export interface AttemptView {
  id: string;
  status: string;
  durationSeconds: number;
  startedAt: Date;
  remainingSeconds: number;
  questions: PublicQuestion[];
}

export async function getAttempt(userId: string, attemptId: string): Promise<AttemptView> {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: { question: { include: QUESTION_WITH_OPTIONS_INCLUDE } },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) {
    // Same 404 whether the attempt doesn't exist or belongs to someone else —
    // don't reveal that a given attempt id exists for another account.
    throw new AppError(404, "ATTEMPT_NOT_FOUND", "Test attempt not found.");
  }

  const elapsedSeconds = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
  const remainingSeconds = Math.max(0, attempt.durationSeconds - elapsedSeconds);

  return {
    id: attempt.id,
    status: attempt.status,
    durationSeconds: attempt.durationSeconds,
    startedAt: attempt.startedAt,
    remainingSeconds,
    questions: attempt.answers.map((answer) => toPublicQuestion(answer.question)),
  };
}

export interface ScoringInput {
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  marks: number;
  negativeMarks: number;
}

export interface ScoringResult {
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
}

// Pure by design so it can be unit tested without a database: marks for
// correct, minus negativeMarks for wrong, zero for unanswered (selectedOptionId
// is null). Used for both explicit submission and time-based expiry.
export function scoreAttempt(items: ScoringInput[]): ScoringResult {
  let score = 0;
  let maxScore = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let skippedCount = 0;

  for (const item of items) {
    maxScore += item.marks;

    if (item.selectedOptionId === null) {
      skippedCount += 1;
      continue;
    }

    if (item.isCorrect) {
      score += item.marks;
      correctCount += 1;
    } else {
      score -= item.negativeMarks;
      wrongCount += 1;
    }
  }

  return { score, maxScore, correctCount, wrongCount, skippedCount };
}

async function finalizeAttempt(attemptId: string, status: "submitted" | "expired") {
  const attempt = await prisma.testAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { answers: true },
  });

  const questions = await prisma.question.findMany({
    where: { id: { in: attempt.answers.map((answer) => answer.questionId) } },
    select: { id: true, marks: true, negativeMarks: true },
  });
  const questionById = new Map(questions.map((question) => [question.id, question]));

  const result = scoreAttempt(
    attempt.answers.map((answer) => {
      const question = questionById.get(answer.questionId)!;
      return {
        selectedOptionId: answer.selectedOptionId,
        isCorrect: answer.isCorrect,
        marks: question.marks,
        negativeMarks: question.negativeMarks,
      };
    }),
  );

  return prisma.testAttempt.update({
    where: { id: attemptId },
    data: {
      status,
      submittedAt: new Date(),
      score: result.score,
      maxScore: result.maxScore,
      correctCount: result.correctCount,
      wrongCount: result.wrongCount,
      skippedCount: result.skippedCount,
    },
  });
}

export interface AnswerInput {
  questionId: string;
  selectedOptionId: string | null;
  timeSpentMs: number;
}

export async function recordAnswers(userId: string, attemptId: string, answers: AnswerInput[]): Promise<void> {
  const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) {
    throw new AppError(404, "ATTEMPT_NOT_FOUND", "Test attempt not found.");
  }

  if (attempt.status !== "in_progress") {
    throw new AppError(409, "ATTEMPT_NOT_IN_PROGRESS", "This attempt is no longer in progress.");
  }

  const elapsedSeconds = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
  if (elapsedSeconds >= attempt.durationSeconds) {
    await finalizeAttempt(attemptId, "expired");
    throw new AppError(409, "ATTEMPT_EXPIRED", "This attempt's time has elapsed.");
  }

  for (const answer of answers) {
    let isCorrect: boolean | null = null;

    if (answer.selectedOptionId !== null) {
      const option = await prisma.questionOption.findUnique({ where: { id: answer.selectedOptionId } });
      if (!option || option.questionId !== answer.questionId) {
        throw new AppError(
          400,
          "VALIDATION_ERROR",
          `selectedOptionId does not belong to questionId ${answer.questionId}`,
        );
      }
      isCorrect = option.isCorrect;
    }

    await prisma.attemptAnswer.upsert({
      where: { attemptId_questionId: { attemptId, questionId: answer.questionId } },
      update: { selectedOptionId: answer.selectedOptionId, isCorrect, timeSpentMs: answer.timeSpentMs },
      create: {
        attemptId,
        questionId: answer.questionId,
        selectedOptionId: answer.selectedOptionId,
        isCorrect,
        timeSpentMs: answer.timeSpentMs,
      },
    });
  }
}

export interface ResultSummary {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  wrongCount: number | null;
  skippedCount: number | null;
  submittedAt: Date | null;
}

function toResultSummary(attempt: {
  id: string;
  status: string;
  score: number | null;
  maxScore: number | null;
  correctCount: number | null;
  wrongCount: number | null;
  skippedCount: number | null;
  submittedAt: Date | null;
}): ResultSummary {
  return {
    id: attempt.id,
    status: attempt.status,
    score: attempt.score,
    maxScore: attempt.maxScore,
    correctCount: attempt.correctCount,
    wrongCount: attempt.wrongCount,
    skippedCount: attempt.skippedCount,
    submittedAt: attempt.submittedAt,
  };
}

export async function submitAttempt(userId: string, attemptId: string): Promise<ResultSummary> {
  const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt || attempt.userId !== userId) {
    throw new AppError(404, "ATTEMPT_NOT_FOUND", "Test attempt not found.");
  }

  if (attempt.status === "submitted" || attempt.status === "expired") {
    // Idempotent: the stored result is returned as-is, never recalculated.
    return toResultSummary(attempt);
  }

  if (attempt.status !== "in_progress") {
    throw new AppError(409, "ATTEMPT_NOT_SUBMITTABLE", "This attempt cannot be submitted.");
  }

  const updated = await finalizeAttempt(attemptId, "submitted");
  return toResultSummary(updated);
}

export interface ResultQuestion {
  id: string;
  stemEn: string;
  stemTa: string | null;
  explanationEn: string | null;
  explanationTa: string | null;
  selectedOptionId: string | null;
  timeSpentMs: number | null;
  subject: string;
  unit: string;
  options: Array<{
    id: string;
    label: string;
    textEn: string;
    textTa: string | null;
    isCorrect: boolean;
  }>;
}

export interface AttemptResult extends ResultSummary {
  questions: ResultQuestion[];
}

export async function getResult(userId: string, attemptId: string): Promise<AttemptResult> {
  const attempt = await prisma.testAttempt.findUnique({
    where: { id: attemptId },
    include: {
      answers: {
        include: { question: { include: QUESTION_WITH_OPTIONS_INCLUDE } },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) {
    throw new AppError(404, "ATTEMPT_NOT_FOUND", "Test attempt not found.");
  }

  if (attempt.status !== "submitted" && attempt.status !== "expired") {
    throw new AppError(409, "ATTEMPT_NOT_FINISHED", "Results are only available after the attempt is submitted.");
  }

  return {
    ...toResultSummary(attempt),
    questions: attempt.answers.map((answer) => ({
      id: answer.question.id,
      stemEn: answer.question.stemEn,
      stemTa: answer.question.stemTa,
      explanationEn: answer.question.explanationEn,
      explanationTa: answer.question.explanationTa,
      selectedOptionId: answer.selectedOptionId,
      timeSpentMs: answer.timeSpentMs,
      subject: answer.question.unit.subject.name,
      unit: answer.question.unit.name,
      options: answer.question.options
        .slice()
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((option) => ({
          id: option.id,
          label: option.label,
          textEn: option.textEn,
          textTa: option.textTa,
          isCorrect: option.isCorrect,
        })),
    })),
  };
}
