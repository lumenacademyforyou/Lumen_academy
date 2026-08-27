import React, { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useLanguage } from "./contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import { INITIAL_ATTEMPTS } from "./data/initialAttempts";
import { BIOLOGY_QUESTIONS, CHEMISTRY_QUESTIONS, PHYSICS_QUESTIONS } from "./data/questions";
import { TestAttempt, Question, ChapterGoal } from "./types";
import Header from "./components/layout/Header";
import SplashView from "./components/layout/SplashView";
import DailyReminderModal from "./components/layout/DailyReminderModal";
import LumenLogo from "./components/ui/LumenLogo";
import { supabase } from "./services/supabase";
// import { useLocation, useNavigate } from "react-router-dom";

import { useLocation, useNavigate, useParams, Routes, Route, Navigate } from "react-router-dom";
import {
  signOut as supabaseSignOut,
  getProfileGaps,
} from "./services/supabaseAuth";
import { ensureDemoSession } from "./services/demoSession";

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

function AppLoadingFallback() {
  return (
    <div className="w-full min-h-[40vh] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-[var(--teal)] rounded-full animate-spin" />
    </div>
  );
}
import {
  startAttempt,
  patchAnswers,
  submitAttempt as apiSubmitAttempt,
  getResult,
  toLegacyQuestions,
  type QuestionIdMapEntry,
  type AttemptResult,
  type ResultQuestion,
} from "./services/testApi";
// STAGE 7: parallel client for the newer db/assess-backed flow
// (/api/assess/attempts/*), kept separate from lib/testApi.ts above (which
// targets the older, still-live Prisma /api/tests/* routes). Gated by
// VITE_USE_REAL_API — see onQuickDemoFlowC below.
import {
  getSyllabus as getRealSyllabus,
  startAttempt as startAssessAttempt,
  getPaper as getAssessPaper,
  toLegacyQuestions as toLegacyQuestionsFromPaper,
  batchSaveResponses as batchSaveAssessResponses,
  submitAttempt as submitAssessAttempt,
  getScorecard as getAssessScorecard,
  type QuestionIdMapEntry as AssessQuestionIdMapEntry,
} from "./services/assessApi";

const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === "true";



// Builds a TestAttempt from a real, server-scored result. Only score,
// correctness, timing and per-question review are real; subjectBreakdown and
// percentile for subjects this attempt didn't cover are carried forward from
// the previous attempt rather than invented, since we have no new
// information about them.
function buildHonestAttemptFromResult(
  result: AttemptResult,
  attemptTitle: string,
  previousAttempts: TestAttempt[]
): TestAttempt {
  const correctCount = result.correctCount ?? 0;
  const wrongCount = result.wrongCount ?? 0;
  const skippedCount = result.skippedCount ?? 0;
  const accuracy = Math.round((correctCount / (correctCount + wrongCount || 1)) * 100);

  const isWrong = (q: ResultQuestion) => {
    if (q.selectedOptionId === null) return false;
    const opt = q.options.find((o) => o.id === q.selectedOptionId);
    return opt ? !opt.isCorrect : false;
  };
  const wrongQuestions = result.questions.filter(isWrong);

  const laggingTopics = wrongQuestions.map((q) => {
    const selected = q.options.find((o) => o.id === q.selectedOptionId);
    const correct = q.options.find((o) => o.isCorrect);
    return {
      topic: q.unit,
      unit: q.unit,
      subject: q.subject as ChapterGoal["subject"],
      accuracy: 0,
      negativeMarksLost: 1,
      conceptGap: `Selected option (${selected?.textEn ?? "Unknown"}) instead of correct option (${correct?.textEn ?? "Unknown"}).`,
      improvementSteps: [
        q.explanationEn ? `Review the core concept: ${q.explanationEn}` : "Review this topic in your syllabus notes.",
        "Re-read the relevant NCERT section and solve a few similar practice problems.",
      ],
      ncertReference: {
        book: `NCERT ${q.subject}`,
        chapter: q.unit,
        pages: "See unit syllabus",
        keyLines: q.explanationEn ?? "No explanation recorded for this question.",
      },
    };
  });

  const legacySubjectKey = (subj: string): "Physics" | "Chemistry" | "Biology" =>
    subj === "Physics" ? "Physics" : subj === "Chemistry" ? "Chemistry" : "Biology";

  const previous = previousAttempts[0];
  const baselineBreakdown = previous?.subjectBreakdown ?? {
    Physics: { score: 0, growth: 0, status: "Average" as const },
    Chemistry: { score: 0, growth: 0, status: "Average" as const },
    Biology: { score: 0, growth: 0, status: "Average" as const },
  };
  const testedKey = result.questions[0] ? legacySubjectKey(result.questions[0].subject) : "Biology";
  const previousScore = baselineBreakdown[testedKey].score;

  const subjectBreakdown = {
    ...baselineBreakdown,
    [testedKey]: {
      score: accuracy,
      growth: parseFloat((accuracy - previousScore).toFixed(1)),
      status: (accuracy >= 90 ? "Expert" : accuracy >= 75 ? "Strong" : "Average") as "Strong" | "Average" | "Expert",
    },
  };

  const uniqueWrongUnits = Array.from(new Set(wrongQuestions.map((q) => q.unit)));

  const questionTimeData = result.questions.map((q, idx) => ({
    questionId: idx + 1,
    subject: q.subject as ChapterGoal["subject"],
    timeSpentSeconds: Math.round((q.timeSpentMs ?? 0) / 1000),
  }));
  const totalTimeSpentSeconds = questionTimeData.reduce((sum, item) => sum + item.timeSpentSeconds, 0);

  return {
    id: result.id,
    title: attemptTitle,
    date: new Date().toLocaleDateString("en-GB"),
    totalScore: result.score ?? 0,
    accuracy,
    percentile: previous?.percentile ?? 0,
    correctAnswers: correctCount,
    incorrectAnswers: wrongCount,
    skippedAnswers: skippedCount,
    timeTakenMinutes: Math.ceil((totalTimeSpentSeconds || 1) / 60),
    subjectBreakdown,
    aiRecommendation: {
      topics: uniqueWrongUnits.slice(0, 2),
      potentialGain: wrongCount * 4 + (skippedCount > 0 ? 4 : 0),
      focusAreas: uniqueWrongUnits.slice(0, 3).map((topic) => ({ topic, level: "Critical" as const })),
    },
    laggingTopics,
    questionTimeData,
    averageTimePerQuestionSeconds: questionTimeData.length > 0 ? Math.round(totalTimeSpentSeconds / questionTimeData.length) : 0,
  };
}

// STAGE 7: simpler counterpart to buildHonestAttemptFromResult above, for
// the newer /api/assess/attempts/:id/scorecard endpoint. That endpoint only
// returns aggregate counts (no per-question correctness/explanation
// breakdown — building that needs a separate endpoint this pass didn't add),
// so laggingTopics/questionTimeData are honestly empty here rather than
// fabricated from data that doesn't exist.
function buildHonestAttemptFromAssessScorecard(
  scorecard: { obtainedMarks: number; correctCount: number; wrongCount: number; skippedCount: number },
  attemptTitle: string,
  previousAttempts: TestAttempt[]
): TestAttempt {
  const accuracy = Math.round((scorecard.correctCount / (scorecard.correctCount + scorecard.wrongCount || 1)) * 100);
  const previous = previousAttempts[0];
  const baselineBreakdown = previous?.subjectBreakdown ?? {
    Physics: { score: 0, growth: 0, status: "Average" as const },
    Chemistry: { score: 0, growth: 0, status: "Average" as const },
    Biology: { score: 0, growth: 0, status: "Average" as const },
  };

  return {
    id: `assess_${Date.now()}`,
    title: attemptTitle,
    date: new Date().toLocaleDateString("en-GB"),
    totalScore: scorecard.obtainedMarks,
    accuracy,
    percentile: previous?.percentile ?? 0,
    correctAnswers: scorecard.correctCount,
    incorrectAnswers: scorecard.wrongCount,
    skippedAnswers: scorecard.skippedCount,
    timeTakenMinutes: 0,
    subjectBreakdown: baselineBreakdown,
    aiRecommendation: { topics: [], potentialGain: scorecard.wrongCount * 4, focusAreas: [] },
    laggingTopics: [],
    questionTimeData: [],
    averageTimePerQuestionSeconds: 0,
  };
}

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
const [userId, setUserId] = useState<string | null>(null);
  const { t } = useLanguage();
  const [hasSeenSplash, setHasSeenSplash] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [studentName, setStudentName] = useState("");
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
  const [customTestConfig, setCustomTestConfig] = useState<{
    title: string;
    questions: Question[];
    durationSeconds: number;
    mode: "standard" | "practice";
    subject: string;
    difficulty?: "Adaptive" | "Easy" | "Medium" | "Hard";
  } | null>(null);
  const [exploredCourse, setExploredCourse] = useState<"physics" | "chemistry" | "biology" | null>(null);

  // Set only when the current test came from the real backend (currently just
  // the Quick Demo entry point — see lib/demoSession.ts). Drives handleCompleteTest
  // to score server-side instead of the local fake-scoring path below.
  const [activeApiAttemptId, setActiveApiAttemptId] = useState<string | null>(null);
  const [apiQuestionIdMap, setApiQuestionIdMap] = useState<Map<number, QuestionIdMapEntry>>(new Map());

  // STAGE 7: same bridge pattern as activeApiAttemptId above, for the newer
  // db/assess-backed flow. Kept as a separate id/map rather than reusing the
  // old ones — the two APIs key responses differently (question_id vs
  // test_question_id), so merging the types would be misleading.
  const [activeAssessAttemptId, setActiveAssessAttemptId] = useState<string | null>(null);
  const [assessQuestionIdMap, setAssessQuestionIdMap] = useState<Map<number, AssessQuestionIdMapEntry>>(new Map());

  // Interactive Chapter Checklist State
  const [chapterGoals, setChapterGoals] = useState<ChapterGoal[]>([
    { id: "g1", subject: "Physics", chapter: "Mechanics & Rotational Dynamics", highYieldTag: "32 Marks", hoursNeeded: 12, completed: false },
    { id: "g2", subject: "Physics", chapter: "Electrostatics & Current Electricity", highYieldTag: "36 Marks", hoursNeeded: 10, completed: true },
    { id: "g3", subject: "Chemistry", chapter: "Organic Reactions & Mechanisms", highYieldTag: "40 Marks", hoursNeeded: 14, completed: false },
    { id: "g4", subject: "Chemistry", chapter: "Inorganic Coordination & p-Block", highYieldTag: "36 Marks", hoursNeeded: 8, completed: false },
    { id: "g5", subject: "Botany", chapter: "Genetics & Molecular Inheritance", highYieldTag: "48 Marks", hoursNeeded: 16, completed: true },
    { id: "g6", subject: "Botany", chapter: "Plant Physiology & Photosynthesis", highYieldTag: "32 Marks", hoursNeeded: 10, completed: false },
    { id: "g7", subject: "Zoology", chapter: "Human Physiology & Neuro-Endocrine", highYieldTag: "52 Marks", hoursNeeded: 18, completed: false },
    { id: "g8", subject: "Zoology", chapter: "Human Reproduction & ART Tech", highYieldTag: "36 Marks", hoursNeeded: 8, completed: false },
  ]);
  const isSyllabusCompleted = chapterGoals.every(g => g.completed);

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

  // Starts the pre-test lobby
  const handleStartLobby = (testId: string) => {
    setActiveAttemptId(testId);
    setCurrentScreen("lobby");
  };

  // Generate appropriate questions for predefined attempts if not using a custom test config
  const fallbackQuestions = useMemo(() => {
    if (customTestConfig) return customTestConfig.questions;
    
    // Combine questions to have a large pool
    const pool = [...BIOLOGY_QUESTIONS, ...CHEMISTRY_QUESTIONS, ...PHYSICS_QUESTIONS];
    
    let requiredCount = 10;
    if (activeAttempt.title.toLowerCase().includes("full syllabus")) {
       requiredCount = 180;
    } else if (activeAttempt.title.toLowerCase().includes("chemistry")) {
       requiredCount = 15;
    } else if (activeAttempt.title.toLowerCase().includes("biology")) {
       requiredCount = 10;
    }
    
    // pad the pool if needed
    let finalQuestions: Question[] = [];
    while (finalQuestions.length < requiredCount) {
       finalQuestions = [...finalQuestions, ...pool];
    }
    // Symmetrical random shuffle and map fresh IDs
    const shuffled = finalQuestions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, requiredCount).map((q, i) => ({ ...q, id: i + 1 }));
  }, [customTestConfig, activeAttempt]);

  const activeDurationSeconds = customTestConfig ? customTestConfig.durationSeconds : fallbackQuestions.length * 60;

  // Enters standard exam taking environment
  const handleStartTest = () => {
    setCurrentScreen("test_taking");
  };

  // Executed when user finishes test taking
  // Real-API path: translates the legacy per-question answer state back into
  // real question/option ids, records answers, submits, and scores server-side.
  const handleCompleteRealAttempt = async (
    attemptId: string,
    selectedAnswers: { [key: number]: number },
    timeMap: Record<number, number>
  ) => {
    try {
      const answers = Array.from(apiQuestionIdMap.entries()).map(([legacyId, entry]) => {
        const optionIndex = selectedAnswers[legacyId];
        const selectedOptionId = optionIndex !== undefined ? entry.optionIdByIndex[optionIndex] ?? null : null;
        const timeSpentMs = (timeMap[legacyId] || 0) * 1000;
        return { questionId: entry.questionId, selectedOptionId, timeSpentMs };
      });

      if (answers.length > 0) {
        await patchAnswers(attemptId, answers);
      }
      await apiSubmitAttempt(attemptId);
      const result = await getResult(attemptId);

      const newAttempt = buildHonestAttemptFromResult(
        result,
        customTestConfig ? customTestConfig.title : "NEET Biology Mini-Mock #12",
        attempts
      );

      if (customTestConfig) {
        setAttempts((prev) => [newAttempt, ...prev]);
      } else {
        setAttempts((prev) => prev.map((a) => (a.id === "mock_12" ? newAttempt : a)));
      }
      setActiveAttemptId(newAttempt.id);
      setActiveApiAttemptId(null);
      setApiQuestionIdMap(new Map());
      setCurrentScreen("evaluating");
    } catch (err) {
      console.error("Failed to submit real test attempt:", err);
      alert("Something went wrong submitting your test. Please check your connection and try again.");
    }
  };

  // STAGE 7: counterpart to handleCompleteRealAttempt above, for the newer
  // db/assess-backed flow. Batch-saves answers (keyed by test_question_id,
  // not question_id), submits (server scores synchronously — see
  // db/assess/test/attempt/attempt-flow.ts), then reads the real scorecard.
  const handleCompleteAssessAttempt = async (
    attemptId: string,
    selectedAnswers: { [key: number]: number },
    timeMap: Record<number, number>
  ) => {
    try {
      const responses = Array.from(assessQuestionIdMap.entries())
        .filter(([legacyId]) => selectedAnswers[legacyId] !== undefined)
        .map(([legacyId, entry]) => {
          const optionIndex = selectedAnswers[legacyId];
          const optionId = entry.optionIdByIndex[optionIndex] ?? null;
          return {
            testQuestionId: entry.testQuestionId,
            option_id: optionId,
            time_spent_seconds: Math.round((timeMap[legacyId] || 0)),
          };
        });

      if (responses.length > 0) {
        await batchSaveAssessResponses(attemptId, responses);
      }
      const submitRes = await submitAssessAttempt(attemptId);

      const newAttempt = buildHonestAttemptFromAssessScorecard(
        submitRes.data.scorecard,
        customTestConfig ? customTestConfig.title : "Real API Test",
        attempts
      );
      setAttempts((prev) => [newAttempt, ...prev]);
      setActiveAttemptId(newAttempt.id);
      setActiveAssessAttemptId(null);
      setAssessQuestionIdMap(new Map());
      setCurrentScreen("evaluating");
    } catch (err) {
      console.error("Failed to submit assess API attempt:", err);
      alert("Something went wrong submitting your test. Please check your connection and try again.");
    }
  };

  const handleCompleteTest = async (
    selectedAnswers: { [key: number]: number },
    flaggedQuestions: number[],
    timeMap: Record<number, number>
  ) => {
    if (activeAssessAttemptId) {
      await handleCompleteAssessAttempt(activeAssessAttemptId, selectedAnswers, timeMap);
      return;
    }
    if (activeApiAttemptId) {
      await handleCompleteRealAttempt(activeApiAttemptId, selectedAnswers, timeMap);
      return;
    }

    // 1. Compute dynamic correct, incorrect, skipped scores
    const activeQuestions = fallbackQuestions;
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;
    const incorrectQuestions: Question[] = [];

    activeQuestions.forEach((q) => {
      const answer = selectedAnswers[q.id];
      if (answer === undefined) {
        skipped++;
      } else if (answer === q.correctAnswerIndex) {
        correct++;
      } else {
        incorrect++;
        incorrectQuestions.push(q);
      }
    });

    // NEET Marking Scheme: +4 for correct, -1 for incorrect
    const calculatedScore = (correct * 4) - incorrect;
    const calculatedAccuracy = Math.round((correct / (correct + incorrect || 1)) * 100);

    // Dynamic Lagging Topics generation
    const generatedLaggingTopics = incorrectQuestions.map((iq) => {
      const ref = typeof iq.ncertReference === "object" && iq.ncertReference !== null ? iq.ncertReference : {
        book: `NCERT Class 12 ${iq.subject}`,
        chapter: iq.unit || "Syllabus Unit",
        pages: "NCERT Standard Section",
        keyLines: iq.explanation
      };

      return {
        topic: iq.unit || iq.subject,
        unit: iq.unit || "Core Concept",
        subject: iq.subject,
        accuracy: 0,
        negativeMarksLost: 4,
        conceptGap: `Selected option (${iq.options[selectedAnswers[iq.id]] || "Unknown"}) instead of correct option (${iq.options[iq.correctAnswerIndex]}).`,
        improvementSteps: [
          `Review the core concept: ${iq.explanation}`,
          `Re-read NCERT section carefully and solve 5 similar practice problems.`
        ],
        ncertReference: ref
      };
    });

    // Default fallback if no incorrect questions
    const finalLagging = generatedLaggingTopics.length > 0 ? generatedLaggingTopics : [
      {
        topic: "Hardy-Weinberg Heterozygote Frequency (2pq)",
        unit: "Genetics & Evolution",
        subject: "Biology" as const,
        accuracy: 85,
        negativeMarksLost: 0,
        conceptGap: "Minor hesitation on calculating binomial frequencies under selection pressure.",
        improvementSteps: ["Review binomial expansion formula: p² + 2pq + q² = 1."],
        ncertReference: {
          book: "NCERT Class 12 Biology",
          chapter: "Chapter 7: Evolution",
          pages: "Pages 136 - 137",
          keyLines: "2pq represents the proportion of heterozygous carriers in Hardy-Weinberg equilibrium."
        }
      }
    ];

    // 2. Build the completed TestAttempt structure
    const attemptId = customTestConfig ? `custom_${Date.now()}` : "mock_12";
    const attemptTitle = customTestConfig ? customTestConfig.title : "NEET Biology Mini-Mock #12";

    // Compute time stats
    const questionTimeData = Object.keys(timeMap).map((idStr) => {
      const qId = parseInt(idStr);
      const q = activeQuestions.find((q) => q.id === qId);
      return {
        questionId: qId,
        subject: q ? q.subject : ("Biology" as "Physics" | "Chemistry" | "Biology"),
        timeSpentSeconds: timeMap[qId] || 0
      };
    });
    const totalTimeSpent = questionTimeData.reduce((acc, curr) => acc + curr.timeSpentSeconds, 0);
    const averageTimePerQuestionSeconds = questionTimeData.length > 0 ? Math.round(totalTimeSpent / questionTimeData.length) : 0;

    const newAttempt: TestAttempt = {
      id: attemptId,
      title: attemptTitle,
      date: new Date().toLocaleDateString("en-GB"),
      totalScore: calculatedScore,
      accuracy: calculatedAccuracy,
      percentile: parseFloat((75 + (correct * (20 / activeQuestions.length))).toFixed(1)), // rewarding percentile simulation
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      skippedAnswers: skipped,
      timeTakenMinutes: Math.ceil((totalTimeSpent || 1) / 60),
      subjectBreakdown: {
        Physics: { score: customTestConfig?.subject === "Physics" ? calculatedAccuracy : 88, growth: 12.4, status: "Strong" },
        Chemistry: { score: customTestConfig?.subject === "Chemistry" ? calculatedAccuracy : 76, growth: 5.2, status: "Average" },
        Biology: { 
          score: customTestConfig?.subject === "Biology" || customTestConfig?.subject === "Full" ? calculatedAccuracy : 92, 
          growth: parseFloat(((calculatedAccuracy - 92) / 10).toFixed(1)), 
          status: calculatedAccuracy >= 90 ? "Expert" : calculatedAccuracy >= 75 ? "Strong" : "Average" 
        }
      },
      aiRecommendation: {
        topics: [
          incorrectQuestions[0]?.unit || (customTestConfig?.subject === "Chemistry" ? "Xenon Hybridization" : "Inorganic Chemistry"),
          incorrectQuestions[1]?.unit || (customTestConfig?.subject === "Physics" ? "Photoelectric Slope" : "Genetics Basics")
        ],
        potentialGain: incorrect * 4 + 4,
        focusAreas: [
          { topic: incorrectQuestions[0]?.unit || "p-Block Elements", level: "Critical" },
          { topic: incorrectQuestions[1]?.unit || "Hardy-Weinberg Frequency", level: calculatedAccuracy >= 80 ? "Done" : "Improvement" },
          { topic: "NCERT Formula Drills", level: "Improvement" }
        ]
      },
      laggingTopics: finalLagging,
      questionTimeData,
      averageTimePerQuestionSeconds
    };

    // 3. Save to active attempts in state
    if (customTestConfig) {
      setAttempts((prev) => [newAttempt, ...prev]);
    } else {
      setAttempts((prev) => prev.map((a) => (a.id === "mock_12" ? newAttempt : a)));
    }
    setActiveAttemptId(attemptId);
    
    // 4. Move to evaluation load screen
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

  if (!hasSeenSplash) {
    return <SplashView onEnter={() => setHasSeenSplash(true)} />;
  }

  if (!isAuthenticated) {
    return (
      <Suspense fallback={<AppLoadingFallback />}>
      <LandingView
        onLoginSuccess={(name, isNewUser, isAdminFlag) => {
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
          setActiveAttemptId("mock_12");
          setCurrentScreen("system_check");

          if (USE_REAL_API) {
            // STAGE 7: db/assess-backed real flow (VITE_USE_REAL_API=true).
            // Old /api/tests/* demo path below stays reachable by flipping
            // the flag off — "old path is recoverable" per the task spec.
            (async () => {
              try {
                const testId = import.meta.env.VITE_DEMO_TEST_ID;
                if (!testId) {
                  console.warn("VITE_USE_REAL_API is on but VITE_DEMO_TEST_ID is not set — nothing to start.");
                  return;
                }
                // Needs a real Supabase session before any Bearer-authed
                // call — same as the old path below, which calls this too.
                await ensureDemoSession();

                // Proves the real syllabus endpoint works end-to-end; not
                // rendered anywhere yet (see STOP GATE 7 for why).
                const syllabus = await getRealSyllabus();
                console.info(`[assess API] GET /syllabus -> ${syllabus.units.length} real units`);

                const attempt = await startAssessAttempt(testId);
                const attemptId = attempt.data.attempt_id;
                const paper = await getAssessPaper(attemptId);
                const { legacy, idMap } = toLegacyQuestionsFromPaper(paper.data);
                setAssessQuestionIdMap(idMap);
                setActiveAssessAttemptId(attemptId);
                setCustomTestConfig({
                  title: "Real API Test (assess)",
                  questions: legacy,
                  durationSeconds: legacy.length * 60,
                  mode: "standard",
                  subject: "Biology",
                });
              } catch (err) {
                console.warn("Could not start a real assess-API attempt, using local mock questions instead:", err);
              }
            })();
            return;
          }

          // Fire-and-forget: start a real, server-backed attempt in the
          // background. If it fails (e.g. no database configured yet), the
          // demo falls back to the local mock question pool below.
          (async () => {
            try {
              await ensureDemoSession();
              const attempt = await startAttempt({ unitId: "bot_01", count: 10, durationSeconds: 600 });
              const { legacy, idMap } = toLegacyQuestions(attempt.questions);
              setApiQuestionIdMap(idMap);
              setActiveApiAttemptId(attempt.id);
              setCustomTestConfig({
                title: "NEET Biology Mini-Mock #12",
                questions: legacy,
                durationSeconds: attempt.durationSeconds,
                mode: "standard",
                subject: "Biology",
              });
            } catch (err) {
              console.warn("Could not start a real demo attempt, using local mock questions instead:", err);
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
      {showDailyReminder && currentScreen === "portal" && (
        <DailyReminderModal 
          onClose={handleCloseReminder} 
          onTakeTest={handleReminderTakeTest} 
          studentName={studentName} 
        />
      )}
      
      {/* If taking a test, show full test window instead of regular app shell */}
      {currentScreen === "test_taking" ? (
        <TestTakingView
          studentName={studentName}
          onCancel={() => {
            setCustomTestConfig(null);
            setActiveApiAttemptId(null);
            setApiQuestionIdMap(new Map());
            setActiveAssessAttemptId(null);
            setAssessQuestionIdMap(new Map());
            setCurrentScreen("portal");
          }}
          onCompleteTest={handleCompleteTest}
          customQuestions={fallbackQuestions}
          customDurationSeconds={activeDurationSeconds}
          customTitle={customTestConfig ? customTestConfig.title : activeAttempt.title}
          customMode="standard"
        />
      ) : currentScreen === "evaluating" ? (
        <EvaluatingView 
          onEvaluationComplete={handleEvaluationComplete} 
          attempt={attempts.find((a) => a.id === activeAttemptId) || attempts[0]}
        />
      ) : (
        <>
          {/* Main Navigation Header */}
<Header
  currentTab={currentTab}
  setTab={handleNavigation}
  studentName={studentName}
  setStudentName={setStudentName}
  onSignOut={() => {
    supabaseSignOut().catch(() => {});
    setIsAuthenticated(false);
    setIsAdmin(false);
    navigate("/");
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
                {currentScreen === "system_check" ? (
                  <SystemCheckView
                    testTitle={customTestConfig ? customTestConfig.title : activeAttempt.title}
                    onCompleteSystemCheck={() => setCurrentScreen("lobby")}
                    onCancel={() => {
                      setCustomTestConfig(null);
                      setActiveApiAttemptId(null);
                      setApiQuestionIdMap(new Map());
                      setActiveAssessAttemptId(null);
                      setAssessQuestionIdMap(new Map());
                      setCurrentScreen("portal");
                    }}
                  />
                ) : currentScreen === "lobby" ? (
                  <LobbyView
                    testTitle={customTestConfig ? customTestConfig.title : activeAttempt.title}
                    onStartTest={handleStartTest}
                    mode="standard"
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
                        attemptsCount={attempts.filter((a) => a.totalScore > 0 && a.date !== "Available").length}
                      />
                    )}

                    {currentTab === "profile" && (
                        <ProfileView />
                    )}

                    {currentTab === "tests" && (
                      <TestListView
                        attempts={attempts}
                        isSyllabusCompleted={isSyllabusCompleted}
                        onSelectAttempt={(attempt) => {
                          setActiveAttemptId(attempt.id);
                          setTab("dashboard");
                        }}
                        onStartLobby={handleStartLobby}
                        onStartCustomTest={(config) => {
                          setCustomTestConfig(config);
                          setCurrentScreen("lobby");
                        }}
                      />
                    )}

                    

                    {currentTab === "course" && (
                      <CourseAreaView
                        studentName={studentName}
                        chapterGoals={chapterGoals}
                        setChapterGoals={setChapterGoals}
                        onStartCustomTest={(config) => {
                          setCustomTestConfig(config);
                          setCurrentScreen("lobby");
                        }}
                        onNavigateTab={(tab) => setTab(tab)}
                      />
                    )}

                
                {currentTab === "analytics" && (
                  <Suspense fallback={<AppLoadingFallback />}>
                    <AnalyticsView
                      attempts={attempts}
                      shareText={shareText}
                      isExportingPdf={isExportingPdf}
                      onShareReport={handleShareReport}
                      onDownloadPdf={handleDownloadPdf}
                      onGenerateRevisionSheet={() => {
                        const pool = [...BIOLOGY_QUESTIONS, ...CHEMISTRY_QUESTIONS, ...PHYSICS_QUESTIONS];
                        const shuffled = pool.sort(() => 0.5 - Math.random());
                        const finalQuestions = shuffled.slice(0, Math.min(45, shuffled.length)).map((q, i) => ({ ...q, id: i + 1 }));
                        setCustomTestConfig({
                          title: "AI Revision Sheet - 45 Qs",
                          questions: finalQuestions,
                          durationSeconds: 45 * 60,
                          mode: "standard",
                          subject: "Mixed"
                        });
                        setCurrentScreen("lobby");
                      }}
                    />
                  </Suspense>
                )}
              </>
            )}
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
