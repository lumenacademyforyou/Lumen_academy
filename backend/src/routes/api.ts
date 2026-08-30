import { Router, Request, Response } from "express";
import { getQuestionCount, getQuestions } from "../controllers/questionController";
import { getDashboard, getSyllabus } from "../controllers/analyticsController";
import { submitAttempt } from "../controllers/attemptController";
import { generateStudyPlan, evaluateAttemptAI, explainWrongAnswer } from "../controllers/aiController";
import { getAdminStats } from "../controllers/adminController";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { validate } from "../middleware/validate.js";
import { getFullProfile, updateProfile, updateProfileSchema } from "../services/meProfile.service.js";
import { requireRecentOtpReauthentication, deleteOwnAccount } from "../services/deleteAccount.service.js";
import { getSessionStatus, heartbeat, logoutSession } from "../controllers/authSessionController.js";
import { resetDemoAccountData } from "../controllers/demoController.js";
import catalogRouter from "./catalog.routes.js";
import contentRouter from "./content.routes.js";
import coreRouter from "./core.routes.js";
import assessRouter from "./assess.routes.js";
import learnRouter from "./learn.routes.js";
import adminRouter, { requireUserManagePermission } from "./admin.routes.js";

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

// BUG-27 (docs/assessment-tool-debug-plan.md): this used to be reachable by
// any signed-in student with just requireAuth + a fresh OTP — genuine
// self-service deletion, no admin involved at all. The plan's own fix spec
// asks for the "Delete Account" UI removed AND the endpoint itself gated
// behind an admin role check, with a real admin-side path for legitimate
// deletion requests. That admin path already existed and needed no new code
// — POST /admin/users/:id/status {toStatus:"deleted"} (adminUser.service.ts)
// already soft-deletes a target user (bans the auth identity, marks
// core.app_user.status='deleted', leaves an audit row) and is the one this
// route now defers to conceptually. This route stays mounted (rather than
// removed outright) specifically so a normal user hitting it directly gets
// a clean, intentional 403 — matching the plan's own acceptance test —
// instead of a generic 404 that reads like a dead/typo'd endpoint.
router.delete("/me", requireAuth, requireUserManagePermission(), async (req: Request, res: Response, next) => {
  try {
    await requireRecentOtpReauthentication(req.accessToken!);
    await deleteOwnAccount(req.user!.id, req.user!.appUserId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// Phase E (session management/auto logout) — see backend/src/services/session.service.ts.
// requireAuth already resolves+enforces req.sessionInfo before any handler
// below runs; these just expose it over HTTP.
router.get("/auth/session", requireAuth, getSessionStatus);
router.post("/auth/session/heartbeat", requireAuth, heartbeat);
router.post("/auth/session/logout", requireAuth, logoutSession);

// BUG-02 — wipes the caller's own data if (and only if) they're the fixed
// demo account; a no-op for anyone else. Called once, right after the
// "Quick Demo" flow establishes a session, so every demo login starts empty.
router.post("/auth/demo/reset", requireAuth, resetDemoAccountData);

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

// Analytics Endpoint (Phase G — real, SQL-aggregated, scoped to the caller)
router.get("/analytics/dashboard", requireAuth, getDashboard);

// Submit Attempt Endpoint — retired (see backend/src/controllers/attemptController.ts);
// kept mounted so old clients get a clear 410 instead of a 404.
router.post("/submit-attempt", submitAttempt);

// AI Endpoints — all retired (Phase H, H1: no AI calls anywhere in this
// build, and zero frontend callers remained). See
// backend/src/controllers/aiController.ts.
router.post("/ai/study-plan", generateStudyPlan);
router.post("/ai/evaluate-attempt", evaluateAttemptAI);
router.post("/ai/explain", explainWrongAnswer);

// Admin Endpoint. Data is still hardcoded placeholder content (not this
// phase's concern to make real) but the route itself was wide open to any
// caller, authenticated or not — found while auditing route wiring for
// CL-P6. Gated the same way catalog's write routes now are.
router.get("/admin/stats", requireAuth, requirePermission("admin:stats"), getAdminStats);

export default router;
