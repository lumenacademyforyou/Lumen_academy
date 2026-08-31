import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { useLanguage } from "./contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import { INITIAL_ATTEMPTS } from "./data/initialAttempts";
import { TestAttempt, ChapterGoal, CatalogTree, SessionResult, Scorecard } from "./types";
import Header from "./components/layout/Header";
import DailyReminderModal from "./components/layout/DailyReminderModal";
import LumenLogo from "./components/ui/LumenLogo";
import { supabase } from "./services/supabase";
// import { useLocation, useNavigate } from "react-router-dom";

import { useLocation, useNavigate, useParams, Routes, Route, Navigate } from "react-router-dom";
import {
  signOut as supabaseSignOut,
  getProfileGaps,
} from "./services/supabaseAuth";
import { ensureDemoSession, isDemoEmail, isDemoLoginInFlight } from "./services/demoSession";
import { suppressGoogleOneTapForSession } from "./services/googleOneTap";
import { clearMeCache } from "./services/meApi";

// Route-level code splitting (LA-BE-CORE-002 CL-P1): none of these are
// needed for first paint (splash/landing render before any of them), so
// each ships in its own chunk, fetched on first navigation to it instead of
// blocking the initial bundle. See AppLoadingFallback for the Suspense UI.
const DashboardView = lazy(() => import("./pages/DashboardView"));
const LobbyView = lazy(() => import("./pages/LobbyView"));
const TestTakingView = lazy(() => import("./pages/TestTakingView"));
const EvaluatingView = lazy(() => import("./pages/EvaluatingView"));
const TestListView = lazy(() => import("./pages/TestListView"));
const SystemCheckView = lazy(() => import("./pages/SystemCheckView"));
const LandingView = lazy(() => import("./pages/LandingView"));
const CourseAreaView = lazy(() => import("./pages/CourseAreaView"));
const ProfileView = lazy(() => import("./pages/ProfileView"));
const AdminView = lazy(() => import("./pages/AdminView"));
// Pulls in recharts (the largest single dependency in the bundle) — kept out
// of the initial chunk entirely; only fetched when the Analytics tab opens.
const AnalyticsView = lazy(() => import("./pages/AnalyticsView"));
// P1-11 — "View results". Also pulls in recharts transitively (its detailed
// report view embeds P1-7's IrtSection), same reasoning as AnalyticsView above.
const MyResultsView = lazy(() => import("./pages/MyResultsView"));

const SESSION_MODE_LABEL: Record<SessionResult["mode"], string> = {
  "subject-wise": "Subject-wise Practice",
  "full-mock": "Full Mock Exam",
  "image-practice": "Image Only Practice",
  custom: "Custom Test",
};

function AppLoadingFallback() {
  return (
    <div className="w-full min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-[var(--teal)] rounded-full animate-spin" />
    </div>
  );
}

// Branded, full-screen fallback for the exam-launch chain
// (system_check/lobby/test_taking/evaluating) — these are all React.lazy()
// chunks with no Suspense boundary above them before this fix, so the first
// navigation into any of them (e.g. right after "I Understand, Start Test")
// had no loading UI at all. This is what a user waits on while that chunk
// fetches.
function ExamLoadingFallback({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-[#f8f9ff] dark:bg-[#031824]">
      <div className="h-20 w-20">
        <LumenLogo className="w-full h-full" />
      </div>
      <div className="flex flex-col items-center gap-3">
        <span className="font-black text-lg text-[var(--navy)] dark:text-white uppercase tracking-wide">LUMEN ACADEMY</span>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <div className="w-4 h-4 border-2 border-slate-300 border-t-[var(--teal)] dark:border-t-[#FCB824] rounded-full animate-spin" />
          <span>{message}</span>
        </div>
      </div>
    </div>
  );
}
import { getCatalogTree } from "./services/catalogApi";
import { createSession, getActiveSession, pauseAttempt, submitAttempt as submitAttemptApi } from "./services/sessionApi";
import { logoutSession as revokeAuthSession } from "./services/authSessionApi";
import { useIdleSessionGuard, type SessionExpiryReason } from "./hooks/useIdleSessionGuard";
import SessionExpiryModal from "./components/layout/SessionExpiryModal";
import Modal from "./components/layout/Modal";



// Builds a TestAttempt from a real, server-scored result. Only score,
// correctness, timing and per-question review are real; subjectBreakdown and
// percentile for subjects this attempt didn't cover are carried forward from
// the previous attempt rather than invented, since we have no new
// information about them.
// Builds a TestAttempt from the real, server-computed Scorecard (POST
// .../submit's response — LA-APP-COMPLETION-001 Phase D8: the client
// performs no scoring arithmetic, only formats what the server already
// computed). The scorecard endpoint returns aggregate marks/counts only, no
// per-question correctness/explanation breakdown (that's getReview's job,
// not wired into the dashboard's TestAttempt shape here) — so
// laggingTopics/questionTimeData/subjectBreakdown-for-this-attempt are
// honestly carried forward from the previous attempt or left empty, never
// fabricated from data that doesn't exist.
function buildHonestAttemptFromScorecard(scorecard: Scorecard, attemptTitle: string, previousAttempts: TestAttempt[], elapsedMinutes: number): TestAttempt {
  const correctCount = scorecard.correctCount;
  const incorrectCount = scorecard.incorrectCount;
  const skippedCount = scorecard.unattemptedCount;
  const accuracy = Math.round((correctCount / (correctCount + incorrectCount || 1)) * 100);
  const previous = previousAttempts[0];
  const baselineBreakdown = previous?.subjectBreakdown ?? {
    Physics: { score: 0, growth: 0, status: "Average" as const },
    Chemistry: { score: 0, growth: 0, status: "Average" as const },
    Biology: { score: 0, growth: 0, status: "Average" as const },
  };

  return {
    id: scorecard.scorecardId,
    title: attemptTitle,
    date: new Date().toLocaleDateString("en-GB"),
    totalScore: Number(scorecard.obtainedMarks),
    accuracy,
    percentile: previous?.percentile ?? 0,
    correctAnswers: correctCount,
    incorrectAnswers: incorrectCount,
    skippedAnswers: skippedCount,
    timeTakenMinutes: elapsedMinutes,
    subjectBreakdown: baselineBreakdown,
    aiRecommendation: { topics: [], potentialGain: incorrectCount * 4, focusAreas: [] },
    laggingTopics: [],
    questionTimeData: [],
    averageTimePerQuestionSeconds: 0,
  };
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
const [userId, setUserId] = useState<string | null>(null);
  const { t } = useLanguage();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [studentName, setStudentName] = useState("");
  // BUG-03/BUG-06 (docs/assessment-tool-debug-plan.md): a resumable attempt
  // used to be auto-entered with no confirmation — the "ghost test" report.
  // Now it's surfaced as an explicit choice instead (see the modal near the
  // bottom of this component).
  const [resumableSession, setResumableSession] = useState<SessionResult | null>(null);
  const [isResumingDecision, setIsResumingDecision] = useState(false);
  const [attempts, setAttempts] = useState<TestAttempt[]>(INITIAL_ATTEMPTS);
  const [activeAttemptId, setActiveAttemptId] = useState<string>(INITIAL_ATTEMPTS[0].id);
  const [currentTab, setTab] = useState<string>("dashboard");
  const [showDailyReminder, setShowDailyReminder] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
  const pathToTab: Record<string, string> = {
    "/dashboard": "dashboard",
    "/tests": "tests",
    "/course": "course",
    "/analytics": "analytics",
    "/profile": "profile",
    "/results": "results",
  };
  const tab = pathToTab[location.pathname];

  if (tab) {
    setTab(tab);
  }
}, [location.pathname]);
  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
      // Dynamically imported: pulls in jsPDF + html2canvas, only needed once
      // someone actually clicks "Download PDF" (LA-BE-CORE-002 CL-P1).
      const { exportAnalyticsPdf } = await import("./services/pdfExport");
      await exportAnalyticsPdf("analytics-report-container", `Lumen_Academy_Analytics_${studentName.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("PDF export failed, falling back to print dialog:", err);
      window.print();
    } finally {
      setIsExportingPdf(false);
    }
  };

  const [shareText, setShareText] = useState("Share Report");
  const handleShareReport = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Lumen Academy - Analytics Report",
          text: `Check out ${studentName}'s NEET/JEE performance report on Lumen Academy.`,
          url: window.location.href,
        });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareText("Copied!");
        setTimeout(() => setShareText("Share Report"), 2000);
      }
    } catch (err) {
      console.error("Share failed:", err);
    }
  };

  const confettiShownRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (currentTab === "analytics") {
      const completedAttempts = attempts.filter(a => a.totalScore > 0 && a.date !== "Available");
      
      if (completedAttempts.length > 1) {
        // attempts are sorted reverse chronological (newest first)?
        // Wait, completedAttempts might just be in the order they are in the array.
        // Let's sort them by date just to be sure.
        const sortedCompleted = [...completedAttempts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const latestAttempt = sortedCompleted[0];
        const previousAttempts = sortedCompleted.slice(1);
        const isPersonalBest = latestAttempt.totalScore > Math.max(...previousAttempts.map(a => a.totalScore));
        
        if (isPersonalBest && confettiShownRef.current !== latestAttempt.id) {
          confettiShownRef.current = latestAttempt.id;

          // Slight delay for animation
          setTimeout(async () => {
            // Dynamically imported: only needed on a personal-best reveal,
            // not on every load (LA-BE-CORE-002 CL-P1).
            const { default: confetti } = await import("canvas-confetti");
            const duration = 3 * 1000;
            const end = Date.now() + duration;

            const frame = () => {
              confetti({
                particleCount: 5,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: ['#00243B', '#115D75', '#1A7A99', '#FCB824']
              });
              confetti({
                particleCount: 5,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: ['#00243B', '#115D75', '#1A7A99', '#FCB824']
              });

              if (Date.now() < end) {
                requestAnimationFrame(frame);
              }
            };
            frame();
          }, 500);
        }
      }
    }
  }, [currentTab, attempts]);

  useEffect(() => {
    if (isAuthenticated && !sessionStorage.getItem('daily_reminder_seen')) {
      const completedAttempts = attempts.filter(a => a.totalScore > 0 && a.date !== "Available");
      // A user with zero completed attempts has never "left off" anywhere —
      // this used to fall into an else branch that fired the same "you
      // haven't attempted a test in 24 hours" reminder for brand-new users,
      // which is exactly backwards. Only nag a user who has a real prior
      // attempt to compare against.
      if (completedAttempts.length > 0) {
        const recentDateStr = completedAttempts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date;
        const recentDate = new Date(recentDateStr);
        const now = new Date();
        const diffMs = now.getTime() - recentDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours > 24) {
          setShowDailyReminder(true);
        }
      }
    }
  }, [isAuthenticated, attempts]);

  const handleCloseReminder = () => {
    setShowDailyReminder(false);
    sessionStorage.setItem('daily_reminder_seen', 'true');
  };

  const handleReminderTakeTest = () => {
    handleCloseReminder();
    setTab("tests");
  };

 const [profileGaps, setProfileGaps] = useState<string[]>([]);

useEffect(() => {
  const initializeAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      setProfileGaps(getProfileGaps(session));
      setIsAuthenticated(true);

      // Optional: get the user's name from metadata
      const name =
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        session.user.email?.split("@")[0] ||
        "Student";

      setStudentName(name);
    } else {
      setIsAuthenticated(false);
    }
  };

  initializeAuth();

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session?.user) {
      // Real race found live while verifying BUG-10's layout fix: this
      // listener fires (and used to reveal the whole authenticated app)
      // the instant ensureDemoSession()'s signInWithPassword resolves —
      // before handleDemoAccountLogin's own `await resetDemoAccountData()`
      // has actually finished wiping the account. A fast click into
      // "Start Practice" in that window creates a real attempt that the
      // still-in-flight reset then deletes moments later (confirmed via a
      // 404 "assess.test not found" straight out of startAttempt). Defer to
      // that flow's own onLoginSuccess call instead of racing ahead of it.
      if (isDemoEmail(session.user.email) && isDemoLoginInFlight()) return;

      setProfileGaps(getProfileGaps(session));
      setIsAuthenticated(true);

      const name =
        session.user.user_metadata?.full_name ||
        session.user.user_metadata?.name ||
        session.user.email?.split("@")[0] ||
        "Student";

      setStudentName(name);
    } else {
      setProfileGaps([]);
      setIsAuthenticated(false);
      setIsAdmin(false);
    }
  });

  return () => subscription.unsubscribe();
}, []);
  const [currentScreen, setCurrentScreen] = useState<"portal" | "system_check" | "lobby" | "test_taking" | "evaluating">("portal");
  // Mirrors currentScreen for reads inside async callbacks (e.g. the
  // reload-survival check below) that must see the *latest* screen at
  // resolution time, not whatever it was when the closure was created.
  const currentScreenRef = useRef(currentScreen);
  currentScreenRef.current = currentScreen;
  const [exploredCourse, setExploredCourse] = useState<"physics" | "chemistry" | "biology" | null>(null);

  // The just-created real session (LA-APP-COMPLETION-001 Phase C's
  // POST /api/assess/sessions) — set once by whichever entry point launched
  // a test (test directory, course unit mock, study-plan recommended test),
  // consumed by system_check/lobby/test_taking, cleared on completion/cancel.
  const [activeSession, setActiveSession] = useState<SessionResult | null>(null);

  // Subject/unit tree with live published-question counts (GET /api/catalog/tree)
  // — the one source every test-launch entry point (directory, course
  // drill-down, study-plan handoff) reads from. Fetched once per
  // authenticated session rather than per-screen, so every consumer sees the
  // same data and there's a single loading/error state to handle (D10).
  const [catalogTree, setCatalogTree] = useState<CatalogTree | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getCatalogTree()
      .then((tree) => {
        if (!cancelled) setCatalogTree(tree);
      })
      .catch((err) => {
        if (!cancelled) setCatalogError(err instanceof Error ? err.message : "Could not load the subject/unit catalog.");
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // LA-APP-COMPLETION-001 Phase E (E1/E4) — reload/re-login survival. Every
  // fresh authenticated app load (a real page reload, or landing back here
  // after an idle-logout-and-relogin) checks for an attempt this user left
  // mid-flight and drops straight back into it — resuming server-side first
  // if it was paused — instead of losing it and showing the dashboard.
  // Deliberately independent of the idle-guard below: this also covers a
  // plain browser refresh, which has nothing to do with idle timeout.
  //
  // Real race found live while writing Phase F6's Playwright journeys: this
  // lookup is async and was applying unconditionally on resolution, so a
  // slow response could land *after* the user had already manually launched
  // a brand-new session (e.g. clicked "Start Practice" while this was still
  // in flight) — silently clobbering the fresh session with a stale one.
  // Guarded on currentScreenRef below: only ever resume into a screen the
  // user hasn't already navigated away from "portal" on their own.
  useEffect(() => {
    if (!isAuthenticated || isAdmin) return;
    let cancelled = false;
    getActiveSession()
      .then((session) => {
        if (cancelled || !session || currentScreenRef.current !== "portal") return;
        // BUG-03/BUG-06: never silently drop the user back into a running
        // countdown on their behalf — surface it as a choice instead. If the
        // attempt had already expired server-side, getActiveSession's own
        // envelope call just force-closed it and returned null here, so
        // there's nothing to prompt about — the normal portal view is
        // already correct in that case.
        setResumableSession(session);
      })
      .catch(() => {
        // No resumable attempt, or the lookup failed — falling through to
        // the normal portal view is the correct default either way.
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isAdmin]);

  /**
   * The one way an already-started attempt gets back on screen. Shared by the
   * portal's "Resume Test" prompt and by the Resume button on a paused row in
   * View Results (docs/test-engine-fix-prompt.md Defect 3) — extracted rather
   * than copied, specifically so the fullscreen call below cannot be present
   * on one resume path and missing on the other.
   *
   * Test-layer hardening B6 regression fix: this runs from a real, direct
   * click, but it jumps straight into test_taking, bypassing LobbyView
   * entirely — and LobbyView's handleContinue is the only place fullscreen was
   * ever requested. Without this, resuming a paused attempt landed on
   * TestTakingView's own "must be fullscreen" overlay every time, with no
   * browser-fullscreen request ever having been made for this entry path —
   * reported live as "can't resume the test." Same best-effort pattern as
   * LobbyView's own call.
   */
  const enterResumedSession = (session: SessionResult) => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setActiveSession(session);
    setResumableSession(null);
    setCurrentScreen("test_taking");
  };

  const handleResumeSession = () => {
    if (!resumableSession) return;
    enterResumedSession(resumableSession);
  };

  const handleSubmitResumableNow = async () => {
    if (!resumableSession) return;
    setIsResumingDecision(true);
    try {
      const scorecard = await submitAttemptApi(resumableSession.attemptId);
      const durationSeconds = resumableSession.test.durationMinutes ? resumableSession.test.durationMinutes * 60 : resumableSession.remainingSeconds || 0;
      const elapsedMinutes = Math.round(Math.max(0, durationSeconds - resumableSession.remainingSeconds) / 60);
      const newAttempt = buildHonestAttemptFromScorecard(scorecard, resumableSession.test.title, attempts, elapsedMinutes);
      setAttempts((prev) => [newAttempt, ...prev]);
      setActiveAttemptId(newAttempt.id);
      setResumableSession(null);
      setCurrentScreen("evaluating");
    } catch {
      // Leave the prompt up — the attempt is still safely paused/in_progress
      // server-side either way, so the user can just try again.
    } finally {
      setIsResumingDecision(false);
    }
  };

  // Message surfaced on the landing page after a forced sign-out (idle or
  // absolute session timeout) — cleared on the next successful login.
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  // Central "this session is over, one way or another" path — shared by the
  // idle/absolute-timeout guard below and by a manual sign-out, so both
  // leave the local session row and any in-progress attempt in the same
  // honest state (E3: server-side revocation, not just client-side hiding;
  // E4: an in-progress attempt is paused, never silently abandoned mid-clock).
  const endSession = async (message: string | null) => {
    if (activeSession && currentScreen === "test_taking" && activeSession.status === "in_progress") {
      await pauseAttempt(activeSession.attemptId).catch(() => {});
    }
    await revokeAuthSession(message ? "forced" : "user_logout").catch(() => {});
    await supabaseSignOut().catch(() => {});
    // Any sign-out through this shared path — explicit or forced — must not
    // be immediately undone by Google One Tap silently re-authenticating the
    // same browser session (P0-1).
    suppressGoogleOneTapForSession();
    // P2-13: the cached /me response must not leak into whichever account
    // signs in next within the cache's TTL window.
    clearMeCache();
    setAuthMessage(message);
    setIsAuthenticated(false);
    setIsAdmin(false);
    setActiveSession(null);
    setCurrentScreen("portal");
    // BUG-04 (docs/assessment-tool-debug-plan.md): `attempts`/`activeAttemptId`
    // are plain in-memory SPA state, never fetched from the server and (until
    // this fix) never cleared here — sign-out/sign-in is a client-side route
    // change, not a hard reload, so without this a second account signing in
    // on the same tab could briefly render the previous account's
    // just-completed attempt (EvaluatingView's lookup, the dashboard reminder
    // logic, attemptsCount) before any real data ever loads for them.
    setAttempts(INITIAL_ATTEMPTS);
    setActiveAttemptId(INITIAL_ATTEMPTS[0].id);
    navigate("/");
  };

  const handleSessionExpired = (reason: SessionExpiryReason) => {
    const message =
      reason === "absolute_timeout"
        ? "Your session reached its maximum length and was ended for security. Please sign in again."
        : "You were signed out due to inactivity. Please sign in again.";
    endSession(message);
  };

  const idleGuard = useIdleSessionGuard(isAuthenticated && !isAdmin, handleSessionExpired);

  // Interactive Chapter Checklist State — BUG-19 (docs/assessment-tool-debug-plan.md
  // Phase 7): real goals now load from the server (learn.study_plan_goal,
  // via StudyPlanView's own mount effect / handleSavePlan) and replace this
  // via setChapterGoals; starts empty rather than a hardcoded fake array so
  // "no plan saved yet" is represented honestly instead of by 8 sample rows
  // that used to include two already marked complete.
  const [chapterGoals, setChapterGoals] = useState<ChapterGoal[]>([]);
  const isSyllabusCompleted = chapterGoals.length > 0 && chapterGoals.every(g => g.completed);

  const activeAttempt = attempts.find((a) => a.id === activeAttemptId) || attempts[0];

  // Switches tab + returns to the main portal screen + syncs the URL. Same
  // logic Header's setTab prop used inline below (kept there too, so this
  // is just the reusable version for callers outside Header, e.g. the
  // footer nav links, which called a same-named function that was never
  // actually defined — a real bug, not a stub left for later).
  const handleNavigation = (tab: string) => {
    setTab(tab);
    setCurrentScreen("portal");

    const paths: Record<string, string> = {
      dashboard: "/dashboard",
      tests: "/tests",
      course: "/course",
      analytics: "/analytics",
      profile: "/profile",
    };

    navigate(paths[tab] || "/dashboard");
  };

  // A session is created (POST /api/assess/sessions) by whichever entry
  // point launched the test; this just records it and enters the pre-test
  // flow (system_check -> lobby -> test_taking), same screen sequence as
  // before.
  const handleSessionCreated = (session: SessionResult) => {
    setActiveSession(session);
    setCurrentScreen("system_check");
  };

  const handleCancelSession = () => {
    setActiveSession(null);
    setCurrentScreen("portal");
  };

  // Enters standard exam taking environment
  const handleStartTest = () => {
    setCurrentScreen("test_taking");
  };

  // TestTakingView owns the whole submit lifecycle itself (autosave, submit,
  // real scorecard — see sessionApi.ts) and only reports the final Scorecard
  // here. No client-side scoring arithmetic (Phase D8).
  const handleSessionComplete = (scorecard: Scorecard, elapsedMinutes: number) => {
    const newAttempt = buildHonestAttemptFromScorecard(scorecard, activeSession?.test.title ?? "Test", attempts, elapsedMinutes);
    setAttempts((prev) => [newAttempt, ...prev]);
    setActiveAttemptId(newAttempt.id);
    setActiveSession(null);
    setCurrentScreen("evaluating");
  };

  // Called when evaluating transition ends
  const handleEvaluationComplete = () => {
    setCurrentScreen("portal");
    setTab("dashboard");
  };

  // timeSpentData/radarData moved into AnalyticsView.tsx — they're only ever
  // used there, and keeping the computation with its one consumer lets that
  // whole chart section (and recharts) load as a separate chunk.

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<AppLoadingFallback />}>
      <LandingView
        authMessage={authMessage}
        onLoginSuccess={(name, isNewUser, isAdminFlag) => {
          setAuthMessage(null);
          setStudentName(name);
          setIsAdmin(!!isAdminFlag);
          setIsAuthenticated(true);
          setTab("dashboard");
          setCurrentScreen("portal");
          navigate("/dashboard");
        }}
        onQuickDemoFlowC={() => {
          setStudentName("Prince A");
          setIsAuthenticated(true);

          // Fire-and-forget: assembles a real 10-question Botany session
          // from the live bank and enters it. No mock fallback — if this
          // fails, the demo stays on the portal rather than showing fake
          // questions (Phase D2/D8: no mock data, no fabricated results).
          (async () => {
            try {
              await ensureDemoSession();
              const tree = catalogTree ?? (await getCatalogTree());
              const botany = tree.subjects.find((s) => s.subjectCode === "BOT") ?? tree.subjects[0];
              if (!botany) throw new Error("No subjects available in the catalog.");
              const session = await createSession({
                mode: "subject-wise",
                title: "NEET Biology Mini-Mock",
                durationMinutes: 10,
                subjectId: botany.subjectId,
                pickCount: 10,
              });
              handleSessionCreated(session);
            } catch (err) {
              console.error("Could not start the quick demo test:", err);
            }
          })();
        }}
      />
      </Suspense>
    );
  }

  if (isAdmin) {
    return (
      <Suspense fallback={<AppLoadingFallback />}>
      <AdminView
        adminName={studentName}
        onLogout={() => {
          setIsAuthenticated(false);
          setIsAdmin(false);
        }}
      />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f172a] flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900 dark:selection:bg-[#FCB824]/40 dark:selection:text-amber-100">
      {idleGuard.showWarning && (
        <SessionExpiryModal
          reason={idleGuard.reason}
          secondsRemaining={idleGuard.secondsRemaining}
          onStayActive={idleGuard.stayActive}
          onSignOutNow={() => endSession(null)}
        />
      )}
      {resumableSession && currentScreen === "portal" && (
        <Modal onClose={() => setResumableSession(null)} closeOnBackdropClick={false} closeOnEscape={false}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
            <h2 className="font-sans font-extrabold text-2xl text-[#00243B] dark:text-white mb-2">{t("Test in progress")}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
              {resumableSession.test.title} — {Math.floor(resumableSession.remainingSeconds / 60)}:
              {String(resumableSession.remainingSeconds % 60).padStart(2, "0")} {t("remaining")}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              {t("You have an unfinished attempt. Resume where you left off, or submit it now with whatever answers you already gave.")}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleResumeSession}
                disabled={isResumingDecision}
                className="w-full py-3 bg-[#ffd15c] hover:bg-amber-500 text-[#00243B] font-bold text-sm uppercase tracking-wide rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {t("Resume Test")}
              </button>
              <button
                onClick={handleSubmitResumableNow}
                disabled={isResumingDecision}
                className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold text-sm uppercase tracking-wide rounded-2xl transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isResumingDecision ? t("Submitting...") : t("Submit Now")}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {showDailyReminder && currentScreen === "portal" && (
        <DailyReminderModal 
          onClose={handleCloseReminder} 
          onTakeTest={handleReminderTakeTest} 
          studentName={studentName} 
        />
      )}
      
      {/* If taking a test, show full test window instead of regular app shell */}
      {currentScreen === "test_taking" && activeSession ? (
        <Suspense fallback={<ExamLoadingFallback message="Starting your exam..." />}>
          <TestTakingView session={activeSession} studentName={studentName} onCancel={handleCancelSession} onCompleteTest={handleSessionComplete} />
        </Suspense>
      ) : currentScreen === "evaluating" ? (
        <Suspense fallback={<ExamLoadingFallback message="Evaluating your responses..." />}>
          <EvaluatingView
            onEvaluationComplete={handleEvaluationComplete}
            attempt={attempts.find((a) => a.id === activeAttemptId) || attempts[0]}
          />
        </Suspense>
      ) : (
        <>
          {/* Main Navigation Header */}
<Header
  currentTab={currentTab}
  setTab={handleNavigation}
  studentName={studentName}
  setStudentName={setStudentName}
  onSignOut={() => {
    endSession(null);
  }}
/>

          {/* Core Content Container */}
          <main className="flex-1 pt-44 lg:pt-32 pb-16 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full print:pt-0 print:pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentScreen}_${currentTab}`}
                initial={{ opacity: 0, y: 16, scale: 0.99, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -12, scale: 0.99, filter: 'blur(4px)' }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <Suspense fallback={<AppLoadingFallback />}>
                {currentScreen === "system_check" && activeSession ? (
                  <SystemCheckView
                    testTitle={activeSession.test.title}
                    testCode={activeSession.testCode}
                    testTypeLabel={SESSION_MODE_LABEL[activeSession.mode]}
                    studentName={studentName}
                    onCompleteSystemCheck={() => setCurrentScreen("lobby")}
                    onCancel={handleCancelSession}
                  />
                ) : currentScreen === "lobby" && activeSession ? (
                  <LobbyView
                    testTitle={activeSession.test.title}
                    testCode={activeSession.testCode}
                    onStartTest={handleStartTest}
                    mode="standard"
                    hasRecycledItems={activeSession.hasRecycledItems}
                    recycledItemCount={activeSession.recycledItemCount}
                    totalQuestionCount={activeSession.questions.length}
                  />
                ) : (
                  <>
                    {/* Router based on selected Tab */}
                    {currentTab === "dashboard" && (
                      <DashboardView
                        attempt={activeAttempt}
                        studentName={studentName}
                        onTakeTest={() => {
                          setTab("tests");
                          setCurrentScreen("portal");
                        }}
                        catalogTree={catalogTree}
                        onSessionCreated={handleSessionCreated}
                      />
                    )}

                    {currentTab === "profile" && (
                        <ProfileView />
                    )}

                    {currentTab === "tests" && (
                      <TestListView
                        attempts={attempts}
                        catalogTree={catalogTree}
                        catalogError={catalogError}
                        isSyllabusCompleted={isSyllabusCompleted}
                        onSelectAttempt={(attempt) => {
                          setActiveAttemptId(attempt.id);
                          setTab("dashboard");
                        }}
                        onSessionCreated={handleSessionCreated}
                      />
                    )}

                    

                    {currentTab === "course" && (
                      <CourseAreaView
                        studentName={studentName}
                        chapterGoals={chapterGoals}
                        setChapterGoals={setChapterGoals}
                        catalogTree={catalogTree}
                        catalogError={catalogError}
                        onSessionCreated={handleSessionCreated}
                        onNavigateTab={(tab) => setTab(tab)}
                      />
                    )}

                
                {currentTab === "analytics" && (
                  <Suspense fallback={<AppLoadingFallback />}>
                    <AnalyticsView
                      shareText={shareText}
                      isExportingPdf={isExportingPdf}
                      onShareReport={handleShareReport}
                      onDownloadPdf={handleDownloadPdf}
                    />
                  </Suspense>
                )}

                {currentTab === "results" && (
                  <Suspense fallback={<AppLoadingFallback />}>
                    <MyResultsView onResumeAttempt={enterResumedSession} />
                  </Suspense>
                )}
              </>
            )}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Persistent Footer Shell */}
          <footer className="w-full py-12 px-6 md:px-12 bg-gradient-to-br from-[var(--navy)] via-[var(--navy)] to-[var(--navy)] border-t border-[#FCB824]/20 flex flex-col items-center print:hidden">
            <div className="w-full max-w-[1280px] flex flex-col md:flex-row justify-between items-center gap-8 mb-10">
              <div className="flex flex-col gap-2 text-center md:text-left">
                <div className="flex items-center gap-3 md:gap-3.5 justify-center md:justify-start">
                  <LumenLogo className="w-[42px] sm:w-[50px] md:w-[56px] h-[42px] sm:h-[50px] md:h-[56px]  shrink-0" />
                  <div className="flex flex-col justify-center leading-tight text-left">
                    <span className="font-black text-lg md:text-xl text-white tracking-tight block leading-none">LUMEN ACADEMY</span>
                    <span className="text-[8px] md:text-[9px] font-bold text-[#FCB824] tracking-wider mt-0.5 uppercase whitespace-nowrap block">Empowering Future through Learning</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-8 md:gap-12 text-center md:text-left">
                <div className="flex flex-col gap-3">
                  <span className="font-bold text-[10px] text-white tracking-widest uppercase">Learning</span>
                  <button onClick={() => handleNavigation("dashboard")} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">{t("Dashboard")}</button>
                  <button onClick={() => handleNavigation("course")} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">Courses</button>
                  <button onClick={() => handleNavigation("tests")} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">Test Series</button>
                </div>
                <div className="flex flex-col gap-3">
                  <span className="font-bold text-[10px] text-white tracking-widest uppercase">Support</span>
                  <button onClick={() => alert("Lumen Help Center is available 24/7 at support@lumenacademy.edu")} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">Help Center</button>
                  <button onClick={() => alert("NEET Official Syllabi and Formulas reference sheets loaded!")} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">Resources</button>
                  <button onClick={() => alert("Lumen Support ticket opened. Our mentors will email you soon!")} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">Contact</button>
                </div>
              </div>
            </div>

            <div className="w-full max-w-[1280px] pt-8 border-t border-[#00243B]/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-300 font-semibold">
              <span className="bg-[var(--teal)]/40 px-3 py-1.5 rounded-lg border border-[var(--teal)]/60">© 2026 Lumen Academy. All rights reserved.</span>
              <div className="flex gap-6">
                <a onClick={() => alert("Privacy Policy Details: All test data and answers are securely stored offline locally.")} className="hover:text-[#FCB824] transition-colors cursor-pointer">Privacy Policy</a>
                <a onClick={() => alert("Terms of Service Details: Standard educational and mock guidelines apply.")} className="hover:text-[#FCB824] transition-colors cursor-pointer">Terms of Service</a>
                <a onClick={() => alert("Cookie Prefs: Only functional session preferences are saved.")} className="hover:text-[#FCB824] transition-colors cursor-pointer">Cookies</a>
              </div>
            </div>
          </footer>
        </>
      )}

    </div>
  );
}
