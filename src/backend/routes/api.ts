import { Router, Request, Response } from "express";
import { getQuestions } from "../controllers/questionController";
import { getAnalytics, getSyllabus } from "../controllers/analyticsController";
import { submitAttempt } from "../controllers/attemptController";

const router = Router();

// Health Check
router.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "Lumen Academy Backend", timestamp: new Date().toISOString() });
});

// Questions Endpoint
router.get("/questions", getQuestions);

// Syllabus Endpoint
router.get("/syllabus", getSyllabus);

// Analytics Endpoint
router.get("/analytics", getAnalytics);

// Submit Attempt Endpoint
router.post("/submit-attempt", submitAttempt);

export default router;
