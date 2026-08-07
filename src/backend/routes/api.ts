import { Router, Request, Response } from "express";
import { getQuestionCount, getQuestions } from "../controllers/questionController";
import { getAnalytics, getSyllabus } from "../controllers/analyticsController";
import { submitAttempt } from "../controllers/attemptController";
import { generateStudyPlan, evaluateAttemptAI } from "../controllers/aiController";
import { getAdminStats } from "../controllers/adminController";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { AppError } from "../middleware/errorHandler.js";
import { getProfile } from "../services/userProfile.service.js";
import testsRouter from "./tests.routes.js";
import aiRouter from "./ai.routes.js";

const router = Router();

// Auth itself is handled client-side by Supabase Auth. This just returns the
// app-specific profile for whoever the Supabase access token belongs to.
router.get("/me", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const profile = await getProfile(req.user!.id);
    if (!profile) {
      next(new AppError(404, "USER_NOT_FOUND", "User not found."));
      return;
    }
    res.json({ user: profile });
  } catch (err) {
    next(err);
  }
});

// Test Attempt Endpoints (Prisma-backed, replaces /submit-attempt as it's migrated)
router.use("/tests", testsRouter);

// Provider-agnostic AI explanation endpoint (POST /ai/explain). The legacy
// /ai/study-plan and /ai/evaluate-attempt routes below still call Gemini
// directly and are migrated separately.
router.use("/ai", aiRouter);

// Health Check
router.get("/health", async (_req: Request, res: Response) => {
  let db: "up" | "down" = "down";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "up";
  } catch {
    db = "down";
  }
  res.json({ status: "ok", service: "Lumen Academy Backend", db, timestamp: new Date().toISOString() });
});

// Questions Endpoint
router.get("/questions", getQuestions);
router.get("/questions/count", getQuestionCount);

// Syllabus Endpoint
router.get("/syllabus", getSyllabus);

// Analytics Endpoint
router.get("/analytics", getAnalytics);

// Submit Attempt Endpoint
router.post("/submit-attempt", submitAttempt);

// AI Endpoints
router.post("/ai/study-plan", generateStudyPlan);
router.post("/ai/evaluate-attempt", evaluateAttemptAI);

// Admin Endpoint
router.get("/admin/stats", getAdminStats);

export default router;
