import { Request, Response } from "express";
import { ALL_QUESTIONS, BIOLOGY_QUESTIONS, CHEMISTRY_QUESTIONS, PHYSICS_QUESTIONS } from "../../database";

export const getQuestions = (req: Request, res: Response): void => {
  const subject = req.query.subject as string;
  if (subject === "biology") {
    res.json({ status: "success", count: BIOLOGY_QUESTIONS.length, questions: BIOLOGY_QUESTIONS });
    return;
  }
  if (subject === "chemistry") {
    res.json({ status: "success", count: CHEMISTRY_QUESTIONS.length, questions: CHEMISTRY_QUESTIONS });
    return;
  }
  if (subject === "physics") {
    res.json({ status: "success", count: PHYSICS_QUESTIONS.length, questions: PHYSICS_QUESTIONS });
    return;
  }
  res.json({ status: "success", count: ALL_QUESTIONS.length, questions: ALL_QUESTIONS });
};
