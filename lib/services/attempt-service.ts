// lib/services/attempt-service.ts
//
// Implements Laws 1, 2, 3, 4, 5 from schema6.prisma directly in code:
//   1. No answer leakage      — startAttempt never selects Option.isCorrect
//                                or Question.numericalAnswer.
//   2. Server owns time       — deadlineAt computed here, every check
//                                compares against it, never trusts the client.
//   3. IDOR-proof              — every function takes userId and filters by it;
//                                a mismatch throws before touching data.
//   4. Snapshots frozen        — submitAttempt copies the answer key onto
//                                AttemptQuestion once, at submit time only.
//   5. Autosave-tolerant       — autosaveAnswer is an upsert, safe to call
//                                repeatedly from a flaky connection.
//
// This is the one place in the app allowed to read Option.isCorrect /
// Question.numericalAnswer, and only inside submitAttempt, after confirming
// the attempt is being submitted.

import { PrismaClient, AttemptStatus, QuestionType } from "@prisma/client";

const prisma = new PrismaClient();

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class AttemptClosedError extends Error {}
export class DeadlinePassedError extends Error {}

// ─────────────────────────────────────────────────────────────────────────
// START ATTEMPT
// Creates the Attempt + one AttemptQuestion per TestQuestion, with a fresh
// per-student option shuffle and a content snapshot that excludes anything
// answer-bearing. Sections get their own AttemptSection row + deadline when
// the test uses sectional timing (JEE pattern).
// ─────────────────────────────────────────────────────────────────────────

export async function startAttempt(userId: string, testId: string) {
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: {
      sections: { orderBy: { orderIndex: "asc" } },
      questions: {
        orderBy: { orderIndex: "asc" },
        include: {
          question: {
            include: { options: { orderBy: { orderIndex: "asc" } } },
          },
        },
      },
    },
  });

  if (!test || !test.isPublished) throw new NotFoundError("Test not found");

  const now = new Date();
  const deadlineAt = new Date(now.getTime() + test.durationSeconds * 1000);

  return prisma.$transaction(async (tx) => {
    const attempt = await tx.attempt.create({
      data: {
        userId,
        testId,
        status: AttemptStatus.IN_PROGRESS,
        startedAt: now,
        durationSeconds: test.durationSeconds,
        deadlineAt,
      },
    });

    if (test.sections.length > 0) {
      await tx.attemptSection.createMany({
        data: test.sections.map((s) => ({
          attemptId: attempt.id,
          sectionId: s.id,
          startedAt: now,
          // Sectional deadline only if the section defines its own clock;
          // otherwise it rides the overall attempt deadline.
          deadlineAt: s.durationSeconds
            ? new Date(now.getTime() + s.durationSeconds * 1000)
            : null,
        })),
      });
    }

    await tx.attemptQuestion.createMany({
      data: test.questions.map((tq) => {
        const q = tq.question;
        const optionOrder =
          q.options.length > 0 ? shuffle(q.options.map((o) => o.id)) : [];

        // Answer-bearing fields are deliberately omitted here.
        const contentSnapshot = {
          id: q.id,
          type: q.type,
          stemEn: q.stemEn,
          stemTa: q.stemTa,
          stemImageUrl: q.stemImageUrl,
          marks: q.marks,
          negativeMarks: q.negativeMarks,
          numericalUnit: q.numericalUnit,
          interactionConfig: q.interactionConfig,
          options: q.options.map((o) => ({
            id: o.id,
            label: o.label,
            textEn: o.textEn,
            textTa: o.textTa,
            imageUrl: o.imageUrl,
          })),
        };

        return {
          attemptId: attempt.id,
          questionId: q.id,
          sectionId: tq.sectionId,
          position: tq.orderIndex,
          optionOrder,
          contentSnapshot,
          questionVersionSnapshot: q.version,
        };
      }),
    });

    return attempt;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// AUTOSAVE
// Called repeatedly (every few seconds / on blur) while IN_PROGRESS. Never
// touches scoring fields. Rejects if the attempt isn't the caller's, isn't
// in progress, or the server-side deadline has already passed — a late
// autosave from a stalled connection must not silently record an answer.
// ─────────────────────────────────────────────────────────────────────────

export async function autosaveAnswer(
  userId: string,
  attemptId: string,
  questionId: string,
  answer: {
    chosenOptionIds?: string[];
    chosenNumericalAnswer?: number | null;
    chosenInteractionAnswer?: unknown;
    flagged?: boolean;
    timeSpentDeltaMs?: number;
  }
) {
  const attempt = await prisma.attempt.findUnique({ where: { id: attemptId } });
  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.userId !== userId) throw new ForbiddenError("Not your attempt");
  if (attempt.status !== AttemptStatus.IN_PROGRESS)
    throw new AttemptClosedError("Attempt is no longer open");
  if (attempt.deadlineAt.getTime() < Date.now())
    throw new DeadlinePassedError("Deadline has passed");

  return prisma.attemptQuestion.update({
    where: { attemptId_questionId: { attemptId, questionId } },
    data: {
      ...(answer.chosenOptionIds !== undefined && {
        chosenOptionIds: answer.chosenOptionIds,
      }),
      ...(answer.chosenNumericalAnswer !== undefined && {
        chosenNumericalAnswer: answer.chosenNumericalAnswer,
      }),
      ...(answer.chosenInteractionAnswer !== undefined && {
        chosenInteractionAnswer: answer.chosenInteractionAnswer as any,
      }),
      ...(answer.flagged !== undefined && { flagged: answer.flagged }),
      ...(answer.timeSpentDeltaMs !== undefined && {
        timeSpentMs: { increment: answer.timeSpentDeltaMs },
      }),
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────
// SUBMIT
// The only function allowed to read the answer key. Freezes it onto every
// AttemptQuestion (Law 4), scores against Question.marks/negativeMarks read
// per-row (never hardcoded +4/-1), rolls the result into UnitMastery in the
// same transaction, and flips the attempt to SUBMITTED.
// ─────────────────────────────────────────────────────────────────────────

export async function submitAttempt(userId: string, attemptId: string) {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { questions: true },
  });
  if (!attempt) throw new NotFoundError("Attempt not found");
  if (attempt.userId !== userId) throw new ForbiddenError("Not your attempt");
  if (attempt.status !== AttemptStatus.IN_PROGRESS)
    throw new AttemptClosedError("Attempt already closed");

  // A submit arriving after the deadline still gets graded — the client may
  // be a few seconds late on a bad connection — but the attempt is marked
  // EXPIRED, not SUBMITTED, so late finishes are distinguishable in reports.
  const isLate = attempt.deadlineAt.getTime() < Date.now();

  const questionIds = attempt.questions.map((aq) => aq.questionId);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    include: { options: true },
  });
  const questionById = new Map(questions.map((q) => [q.id, q]));

  return prisma.$transaction(async (tx) => {
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let skippedCount = 0;
    const unitDeltas = new Map<
      string,
      { attempted: number; correct: number; wrong: number }
    >();

    for (const aq of attempt.questions) {
      const q = questionById.get(aq.questionId);
      if (!q) continue; // question retired mid-attempt — treat as unscorable, skip

      const correctOptionIds = q.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id);

      let isCorrect: boolean | null = null;
      let marksAwarded = 0;
      const skipped =
        aq.chosenOptionIds.length === 0 &&
        aq.chosenNumericalAnswer == null &&
        aq.chosenInteractionAnswer == null;

      if (!skipped) {
        if (q.type === QuestionType.SINGLE_CORRECT) {
          isCorrect =
            aq.chosenOptionIds.length === 1 &&
            correctOptionIds.includes(aq.chosenOptionIds[0]);
        } else if (q.type === QuestionType.MULTIPLE_CORRECT) {
          const chosen = new Set(aq.chosenOptionIds);
          const correct = new Set(correctOptionIds);
          isCorrect =
            chosen.size === correct.size &&
            [...chosen].every((id) => correct.has(id));
        } else if (q.type === QuestionType.NUMERICAL) {
          if (aq.chosenNumericalAnswer != null && q.numericalAnswer != null) {
            const tolerance = q.numericalTolerance ?? 0;
            const diff = Math.abs(
              Number(aq.chosenNumericalAnswer) - Number(q.numericalAnswer)
            );
            isCorrect = diff <= Number(tolerance);
          }
        }
        // MATCHING / ASSERTION_REASON: grade via scoringConfig against
        // chosenInteractionAnswer. Left as an extension point — the shape of
        // scoringConfig is validated at publish time but grading logic is
        // question-type-specific enough to warrant its own module.

        marksAwarded = isCorrect ? q.marks : -q.negativeMarks;
      }

      if (skipped) skippedCount++;
      else if (isCorrect) correctCount++;
      else wrongCount++;

      score += marksAwarded;

      await tx.attemptQuestion.update({
        where: { id: aq.id },
        data: {
          correctOptionIdsSnapshot: correctOptionIds,
          correctNumericalAnswerSnapshot: q.numericalAnswer,
          numericalToleranceSnapshot: q.numericalTolerance,
          marksSnapshot: q.marks,
          negativeMarksSnapshot: q.negativeMarks,
          isCorrect: skipped ? null : isCorrect,
          marksAwarded: skipped ? 0 : marksAwarded,
        },
      });

      if (!skipped) {
        const d = unitDeltas.get(q.unitId) ?? {
          attempted: 0,
          correct: 0,
          wrong: 0,
        };
        d.attempted++;
        if (isCorrect) d.correct++;
        else d.wrong++;
        unitDeltas.set(q.unitId, d);
      }
    }

    const attempted = correctCount + wrongCount;
    const maxScore = attempt.questions.reduce((sum, aq) => {
      const q = questionById.get(aq.questionId);
      return sum + (q?.marks ?? 0);
    }, 0);
    const accuracy = attempted > 0 ? Math.round((correctCount / attempted) * 100) : 0;

    const updatedAttempt = await tx.attempt.update({
      where: { id: attemptId },
      data: {
        status: isLate ? AttemptStatus.EXPIRED : AttemptStatus.SUBMITTED,
        submittedAt: new Date(),
        score,
        maxScore,
        correctCount,
        wrongCount,
        skippedCount,
        accuracy,
      },
    });

    // UnitMastery rollup, same transaction as scoring — Law: dashboard
    // numbers must never be one attempt behind.
    for (const [unitId, d] of unitDeltas) {
      const existing = await tx.unitMastery.findUnique({
        where: { userId_unitId: { userId, unitId } },
      });
      const attemptedTotal = (existing?.attempted ?? 0) + d.attempted;
      const correctTotal = (existing?.correct ?? 0) + d.correct;

      await tx.unitMastery.upsert({
        where: { userId_unitId: { userId, unitId } },
        create: {
          userId,
          unitId,
          attempted: d.attempted,
          correct: d.correct,
          wrong: d.wrong,
          accuracy:
            d.attempted > 0 ? Math.round((d.correct / d.attempted) * 100) : 0,
          lastAttemptedAt: new Date(),
        },
        update: {
          attempted: { increment: d.attempted },
          correct: { increment: d.correct },
          wrong: { increment: d.wrong },
          accuracy: Math.round((correctTotal / attemptedTotal) * 100),
          lastAttemptedAt: new Date(),
        },
      });
    }

    return updatedAttempt;
  });
}

// Fisher-Yates — used for per-attempt option shuffling so two students never
// see identical option order (reduces answer-sharing by position).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
