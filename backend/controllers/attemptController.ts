import { Request, Response } from "express";
import { ALL_QUESTIONS } from "../../database_sample";

export const submitAttempt = (req: Request, res: Response): void => {
  const { attemptId, userAnswers, durationSeconds } = req.body || {};
  let totalScore = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let skippedCount = 0;

  ALL_QUESTIONS.forEach((q) => {
    const userSelected = userAnswers?.[q.id];
    if (userSelected === undefined || userSelected === null) {
      skippedCount++;
    } else if (userSelected === q.correctAnswerIndex) {
      correctCount++;
      totalScore += 4;
    } else {
      incorrectCount++;
      totalScore -= 1;
    }
  });

  res.json({
    status: "success",
    attemptId: attemptId || `attempt_${Date.now()}`,
    score: totalScore,
    maxScore: ALL_QUESTIONS.length * 4,
    correctCount,
    incorrectCount,
    skippedCount,
    durationSeconds: durationSeconds || 0,
    evaluatedAt: new Date().toISOString(),
  });
};
