import { Router, Request, Response } from "express";
import { getQuestionCount, getQuestions } from "../controllers/questionController";
import { getAnalytics, getSyllabus } from "../controllers/analyticsController";
import { submitAttempt } from "../controllers/attemptController";
import { generateStudyPlan, evaluateAttemptAI } from "../controllers/aiController";
import { getAdminStats } from "../controllers/adminController";
import { prisma } from "../db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { validate } from "../middleware/validate.js";
import { getFullProfile, updateProfile, updateProfileSchema } from "../services/meProfile.service.js";
import { requireRecentOtpReauthentication, deleteOwnAccount } from "../services/deleteAccount.service.js";
import testsRouter from "./tests.routes.js";
import aiRouter from "./ai.routes.js";
import catalogRouter from "./catalog.routes.js";
import contentRouter from "./content.routes.js";
import coreRouter from "./core.routes.js";
import assessRouter from "./assess.routes.js";
import learnRouter from "./learn.routes.js";
import adminRouter from "./admin.routes.js";

const router = Router();

// Auth itself is handled client-side by Supabase Auth. This returns the
// single, authoritative snapshot of whoever the Supabase access token
// belongs to: identity, role, status, tenancy and role-specific profile
// extension, in one response (LA-BE-CORE-002 CL-P4) — replacing the
// frontend's previous direct-PostgREST reads of core.app_user/
// core.student_profile (frontend/supabase.ts's fetchAppUser/
// fetchStudentProfile), which were two-to-four sequential round trips run
// from the browser and are why S-3 was slow.
router.get("/me", requireAuth, async (req: Request, res: Response, next) => {
  try {
    const profile = await getFullProfile(req.user!.appUserId, req.user!.id);
    res.json({ user: profile });
  } catch (err) {
    next(err);
  }
});

// Fields a signed-in user may change about themselves. Everything else
// (email, role, status, institution) is admin/verification-only and is
// rejected outright by updateProfileSchema's .strict() rather than silently
// ignored.
router.patch("/me", requireAuth, validate({ body: updateProfileSchema }), async (req: Request, res: Response, next) => {
  try {
    const profile = await updateProfile(req.user!.appUserId, req.user!.id, req.body);
    res.json({ user: profile });
  } catch (err) {
    next(err);
  }
});

// Self-service account deletion. Requires the caller's session to carry a
// recent (<10 min) OTP-verified amr entry — see deleteAccount.service.ts for
// why that's the actual reauthentication gate instead of Supabase's
// password-update-only reauthenticate() API.
router.delete("/me", requireAuth, async (req: Request, res: Response, next) => {
  try {
    await requireRecentOtpReauthentication(req.accessToken!);
    await deleteOwnAccount(req.user!.id, req.user!.appUserId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Test Attempt Endpoints (Prisma-backed, replaces /submit-attempt as it's migrated)
router.use("/tests", testsRouter);

// Catalog Endpoints (db/catalog/-backed — exam, subject, syllabus, pattern data)
router.use("/catalog", catalogRouter);

// Content Endpoints (db/content/-backed, read-only — see content.routes.ts)
router.use("/content", contentRouter);

// Core Endpoints (db/core/-backed, ownership-scoped — see core.routes.ts)
router.use("/core", coreRouter);

// Assess Endpoints (db/assess/-backed, ownership-scoped — see assess.routes.ts)
router.use("/assess", assessRouter);

// Learn Endpoints (db/learn/-backed, ownership-scoped — see learn.routes.ts)
router.use("/learn", learnRouter);

// Admin: invitations (CL-P6) and user-lifecycle administration (CL-P7) — see admin.routes.ts
router.use("/admin", adminRouter);

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
  res.json({
    status: "ok",
    message: db === "up" ? "API is healthy" : "API is running but the database is unreachable",
    service: "Lumen Academy Backend",
    db,
    timestamp: new Date().toISOString(),
  });
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

// Admin Endpoint. Data is still hardcoded placeholder content (not this
// phase's concern to make real) but the route itself was wide open to any
// caller, authenticated or not — found while auditing route wiring for
// CL-P6. Gated the same way catalog's write routes now are.
router.get("/admin/stats", requireAuth, requirePermission("admin:stats"), getAdminStats);

export default router;
