import { Router, Request, Response } from "express";
import { getQuestionCount, getQuestions } from "../controllers/questionController";
import { getDashboard, getSyllabus } from "../controllers/analyticsController";
import { submitAttempt } from "../controllers/attemptController";
import { generateStudyPlan, evaluateAttemptAI, explainWrongAnswer } from "../controllers/aiController";
import { getAdminStats } from "../controllers/adminController";
import { prisma } from "../lib/db.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { publicReadLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { getFullProfile, updateProfile, updateProfileSchema, syncOnboardingState } from "../services/meProfile.service.js";
import { requireRecentOtpReauthentication, deleteOwnAccount } from "../services/deleteAccount.service.js";
import { getSessionStatus, heartbeat, logoutSession } from "../controllers/authSessionController.js";
import { isEmailRegistered, checkEmailLookupAllowed } from "../services/emailAvailability.service.js";
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
    let profile = await getFullProfile(req.user!.appUserId, req.user!.id);

    // LA-UX-REFRESH-001 F3 — onboarding completes itself once a plan is
    // active and the required profile fields are in. Checked here (rather
    // than inside getFullProfile) so the common case — already completed, or
    // no active plan — costs nothing: the UPDATE only runs when this exact
    // read shows it would actually change something.
    const needsOnboardingSync =
      profile.subscription?.isActive === true &&
      profile.studentProfile !== null &&
      profile.studentProfile.onboardingState !== "completed" &&
      profile.studentProfile.targetYear !== null &&
      profile.studentProfile.classLevel !== null;

    if (needsOnboardingSync) {
      await syncOnboardingState(req.user!.appUserId);
      profile = await getFullProfile(req.user!.appUserId, req.user!.id);
    }

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

// LA-UX-REFRESH-001 F4 — the register form asks this before it ever tries a
// signup, so an already-registered address is reported as a plain inline
// message instead of a failed signUp (or, worse, a silently-swallowed one:
// with e-mail confirmation on, Supabase deliberately returns a *success* for
// an existing address, so the client cannot tell from the signUp response
// alone). Deliberately unauthenticated — it runs on a form nobody has an
// account for yet — and deliberately answers nothing but a boolean, rate
// limited per IP so it can't be swept.
router.get("/auth/email-exists", async (req: Request, res: Response, next) => {
  try {
    const email = typeof req.query.email === "string" ? req.query.email : "";
    if (!email.includes("@") || email.length > 254) {
      res.status(400).json({ error: { code: "INVALID_EMAIL", message: "Provide a valid email address." } });
      return;
    }

    const clientKey = req.ip ?? "unknown";
    if (!checkEmailLookupAllowed(clientKey)) {
      res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many lookups. Try again in a minute." } });
      return;
    }

    res.json({ exists: await isEmailRegistered(email) });
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
//
// The list route is behind requireAuth as of this change. It was open, and
// unpaginated with it, so one anonymous request returned every published
// question in the bank with its options — the answer key was correctly
// withheld (see questionController's own header), but the questions
// themselves are the product. Nothing in the frontend calls it; the test
// engine serves questions through the attempt envelope, which enforces
// attempt ownership. See getQuestions for the paging contract.
//
// The count route stays open deliberately: it answers with a single integer
// and nothing else, which is the sort of thing a public landing page
// legitimately shows ("1,400+ questions"). It gets the tighter
// publicReadLimiter instead, as does /syllabus below — both are the endpoints
// an anonymous script would hammer.
router.get("/questions", requireAuth, getQuestions);
router.get("/questions/count", publicReadLimiter, getQuestionCount);

// Syllabus Endpoint — the NEET syllabus structure (unit names and class
// levels). Public information by nature, so it stays open; rate-limited for
// the same reason as the count above.
router.get("/syllabus", publicReadLimiter, getSyllabus);

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
