import React, { useState, useMemo, useEffect } from "react";
import { useLanguage } from "./contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import AnimatedCounter from "./components/common/AnimatedCounter";
import { INITIAL_ATTEMPTS } from "../database/initialAttempts";
import { BIOLOGY_QUESTIONS, CHEMISTRY_QUESTIONS, PHYSICS_QUESTIONS } from "../database/questions";
import { TestAttempt, Question, ChapterGoal } from "../types";
import Header from "./components/common/Header";
import DashboardView from "./components/views/DashboardView";
import LobbyView from "./components/views/LobbyView";
import TestTakingView from "./components/views/TestTakingView";
import EvaluatingView from "./components/views/EvaluatingView";
import TestListView from "./components/views/TestListView";
import SystemCheckView from "./components/views/SystemCheckView";
import LandingView from "./components/views/LandingView";
import SplashView from "./components/common/SplashView";
import DailyReminderModal from "./components/common/DailyReminderModal";
import LumenLogo from "./components/common/LumenLogo";
import CourseAreaView from "./components/views/CourseAreaView";
import { supabase } from "./supabase";
import { signOut as supabaseSignOut } from "./lib/supabaseAuth";
import confetti from "canvas-confetti";

import AdminView from "./components/views/AdminView";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, BarChart, Bar, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { exportAnalyticsPdf } from "./services/pdfExport";
import { ensureDemoSession } from "./lib/demoSession";
import {
  startAttempt,
  patchAnswers,
  submitAttempt as apiSubmitAttempt,
  getResult,
  toLegacyQuestions,
  type QuestionIdMapEntry,
  type AttemptResult,
  type ResultQuestion,
} from "./lib/testApi";

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

export default function App() {
  const { t } = useLanguage();
  const [hasSeenSplash, setHasSeenSplash] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [studentName, setStudentName] = useState("Prince A");
  const [attempts, setAttempts] = useState<TestAttempt[]>(INITIAL_ATTEMPTS);
  const [activeAttemptId, setActiveAttemptId] = useState<string>("mock_04");
  const [currentTab, setTab] = useState<string>("dashboard");
  const [showDailyReminder, setShowDailyReminder] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    try {
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
          setTimeout(() => {
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
      if (completedAttempts.length > 0) {
        const recentDateStr = completedAttempts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0].date;
        const recentDate = new Date(recentDateStr);
        const now = new Date();
        const diffMs = now.getTime() - recentDate.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);
        
        if (diffHours > 24) {
          setShowDailyReminder(true);
        }
      } else {
        setShowDailyReminder(true);
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

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const meta = session.user.user_metadata as { display_name?: string } | undefined;
        setStudentName(meta?.display_name || session.user.email?.split("@")[0] || session.user.phone || "Student");
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
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

  const handleCompleteTest = async (
    selectedAnswers: { [key: number]: number },
    flaggedQuestions: number[],
    timeMap: Record<number, number>
  ) => {
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

  const timeSpentData = useMemo(() => {
    if (attempts.length === 0 || !attempts[0].questionTimeData) return [];
    const subjectAgg: Record<string, { totalTime: number; count: number }> = {};
    attempts[0].questionTimeData.forEach(item => {
      if (!subjectAgg[item.subject]) {
        subjectAgg[item.subject] = { totalTime: 0, count: 0 };
      }
      subjectAgg[item.subject].totalTime += item.timeSpentSeconds;
      subjectAgg[item.subject].count += 1;
    });
    return Object.keys(subjectAgg).map(subject => ({
      subject,
      avgTime: Math.round(subjectAgg[subject].totalTime / subjectAgg[subject].count)
    }));
  }, [attempts]);

  const radarData = useMemo(() => {
    if (attempts.length === 0 || !attempts[0].subjectBreakdown) return [];
    const bd = attempts[0].subjectBreakdown;
    return [
      { subject: "Physics", score: bd.Physics?.score || 0, fullMark: 100 },
      { subject: "Chemistry", score: bd.Chemistry?.score || 0, fullMark: 100 },
      { subject: "Biology", score: bd.Biology?.score || 0, fullMark: 100 },
    ];
  }, [attempts]);

  if (!hasSeenSplash) {
    return <SplashView onEnter={() => setHasSeenSplash(true)} />;
  }

  if (!isAuthenticated) {
    return (
      <LandingView
        onLoginSuccess={(name, isNewUser, isAdminFlag) => {
          setStudentName(name);
          setIsAdmin(!!isAdminFlag);
          setIsAuthenticated(true);
          setTab("dashboard");
          setCurrentScreen("portal");
        }}
        onQuickDemoFlowC={() => {
          setStudentName("Prince A");
          setIsAuthenticated(true);
          setActiveAttemptId("mock_12");
          setCurrentScreen("system_check");

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
    );
  }

  if (isAdmin) {
    return (
      <AdminView 
        adminName={studentName}
        onLogout={() => {
          setIsAuthenticated(false);
          setIsAdmin(false);
        }} 
      />
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
            setTab={(tab) => {
              setTab(tab);
              setCurrentScreen("portal");
            }}
            studentName={studentName}
            setStudentName={setStudentName}
            onSignOut={() => {
              supabaseSignOut().catch(() => {});
              setIsAuthenticated(false);
              setIsAdmin(false);
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
                        attemptsCount={attempts.length}
                      />
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
                  <div id="analytics-report-container" className="space-y-8 animate-in fade-in duration-500 bg-white dark:bg-slate-900 p-4 rounded-3xl">
                    <div className="px-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h2 className="text-2xl md:text-3xl font-sans font-bold text-slate-900 dark:text-white tracking-tight mb-1">{t("Deep Diagnostics & Analytics")}</h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">{t("Granular performance tracking and trends over your last completed mock sessions.")}</p>
                      </div>
                      <div className="flex items-center gap-3 self-start md:self-auto shrink-0">
                        <button
                          onClick={handleShareReport}
                          className="print:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-[#00243B] dark:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 dark:border-slate-700 shadow-sm cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-sm">
                            {shareText === "Copied!" ? 'check' : 'share'}
                          </span>
                          {shareText === "Share Report" ? t("Share Report") : t(shareText)}
                        </button>
                        <button
                          onClick={handleDownloadPdf}
                          disabled={isExportingPdf}
                          className="print:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--navy)] dark:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50 cursor-pointer"
                        >
                          <span className={`material-symbols-outlined text-sm ${isExportingPdf ? 'animate-spin' : ''}`}>
                            {isExportingPdf ? 'refresh' : 'download'}
                          </span>
                          {isExportingPdf ? t("Generating PDF...") : t("Download PDF")}
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left graph container card */}
                      <div className="lg:col-span-8 bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
                        <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Trend Evaluation Overview")}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Overall percentile and total correct score distribution")}</p>
                        
                        {/* Interactive spline area chart for score trends */}
                        <motion.div 
                          className="h-72 pt-4 border-b border-slate-200 dark:border-slate-700 pb-2 w-full"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.1 }}
                        >
                          {attempts.length > 0 ? (() => {
                            const getPeakTopic = (attempt: TestAttempt) => {
                              if (attempt.aiRecommendation?.focusAreas?.length) {
                                const doneTopic = attempt.aiRecommendation.focusAreas.find(f => f.level === "Done" || f.level === "Improvement");
                                if (doneTopic) return doneTopic.topic;
                              }
                              if (attempt.aiRecommendation?.topics?.length) {
                                return attempt.aiRecommendation.topics[0];
                              }
                              if (attempt.subjectBreakdown) {
                                const sorted = Object.entries(attempt.subjectBreakdown).sort((a, b) => b[1].score - a[1].score);
                                if (sorted.length) return `${sorted[0][0]} (${sorted[0][1].score}%)`;
                              }
                              return "General Mastery";
                            };

                            const getTroughTopic = (attempt: TestAttempt) => {
                              if (attempt.laggingTopics?.length) {
                                return attempt.laggingTopics[0].topic;
                              }
                              if (attempt.aiRecommendation?.focusAreas?.length) {
                                const critical = attempt.aiRecommendation.focusAreas.find(f => f.level === "Critical");
                                if (critical) return critical.topic;
                              }
                              if (attempt.subjectBreakdown) {
                                const sorted = Object.entries(attempt.subjectBreakdown).sort((a, b) => a[1].score - b[1].score);
                                if (sorted.length) return `${sorted[0][0]} (${sorted[0][1].score}%)`;
                              }
                              return "Concept Gap";
                            };

                            const chronologicalAttempts = [...attempts].reverse();
                            const first90AttemptId = chronologicalAttempts.find(a => a.accuracy >= 90)?.id;
                            const firstFullSyllabusAttemptId = chronologicalAttempts.find(a => a.title.toLowerCase().includes("full syllabus"))?.id;

                            const rawData = chronologicalAttempts.slice(-5).map((attempt, index, arr) => {
                              const prevAttempt = index > 0 ? arr[index - 1] : null;
                              const currentPercentile = attempt.percentile || 0;
                              const prevPercentile = prevAttempt ? (prevAttempt.percentile || 0) : null;
                              const percentileShift = prevPercentile !== null ? Number((currentPercentile - prevPercentile).toFixed(1)) : 0;

                              return {
                                name: attempt.date ? (attempt.date.includes('T') ? attempt.date.split('T')[0] : attempt.date) : 'Recent',
                                score: attempt.accuracy,
                                percentile: currentPercentile,
                                percentileShift,
                                hasPrevious: prevPercentile !== null,
                                title: attempt.title,
                                peakTopic: getPeakTopic(attempt),
                                troughTopic: getTroughTopic(attempt),
                                isFirst90: attempt.id === first90AttemptId,
                                isFirstFullSyllabus: attempt.id === firstFullSyllabusAttemptId,
                                attempt
                              };
                            });

                            let peakIndex = -1;
                            let troughIndex = -1;
                            let maxScore = -1;
                            let minScore = 999;

                            rawData.forEach((item, idx) => {
                              if (item.score > maxScore) {
                                maxScore = item.score;
                                peakIndex = idx;
                              }
                              if (item.score < minScore) {
                                minScore = item.score;
                                troughIndex = idx;
                              }
                            });

                            if (troughIndex === peakIndex) {
                              troughIndex = -1;
                            }

                            const renderCustomTick = (props: any) => {
                              const { x, y, payload } = props;
                              const dataItem = rawData.find(d => d.name === payload.value);
                              const showStar = dataItem && (dataItem.isFirst90 || dataItem.isFirstFullSyllabus);

                              return (
                                <g transform={`translate(${x},${y})`}>
                                  <text x={0} y={0} dy={16} textAnchor="middle" fill="#64748b" fontSize={10}>
                                    {payload.value}
                                  </text>
                                  {showStar && (
                                    <text x={0} y={0} dy={30} textAnchor="middle" fontSize={12}>
                                      <title>{dataItem.isFirst90 ? "First 90%+ Accuracy!" : "First Full Syllabus!"}</title>
                                      ⭐
                                    </text>
                                  )}
                                </g>
                              );
                            };

                            const renderCustomDot = (props: any) => {
                              const { cx, cy, index, payload } = props;
                              if (cx === undefined || cy === undefined || !payload) return null;

                              const isPeak = index === peakIndex;
                              const isTrough = index === troughIndex;
                              const truncate = (s: string) => s.length > 18 ? s.slice(0, 16) + '…' : s;

                              if (isPeak) {
                                const isFirst = index === 0;
                                const isLast = index === rawData.length - 1;
                                const boxWidth = 140;
                                const boxHeight = 34;
                                
                                let rectX = -70;
                                let textX = 0;
                                if (isFirst) { rectX = -10; textX = 60; }
                                else if (isLast) { rectX = -130; textX = -60; }

                                return (
                                  <g key={`dot-peak-${index}`}>
                                    <circle cx={cx} cy={cy} r={9} fill="#10B981" fillOpacity={0.25} />
                                    <circle cx={cx} cy={cy} r={5} fill="#10B981" stroke="#00243B" strokeWidth={2} />
                                    
                                    <g transform={`translate(${cx}, ${cy - 8})`}>
                                      <polygon points="-5,-3 5,-3 0,2" fill="#10B981" />
                                      <rect
                                        x={rectX}
                                        y={-boxHeight - 3}
                                        width={boxWidth}
                                        height={boxHeight}
                                        rx={8}
                                        fill="#00243B"
                                        stroke="#10B981"
                                        strokeWidth={1.5}
                                        style={{ filter: "drop-shadow(0px 4px 10px rgba(16, 185, 129, 0.35))" }}
                                      />
                                      <text x={textX} y={-boxHeight + 11} textAnchor="middle" fill="#10B981" fontSize={9} fontWeight={800} letterSpacing="0.5">
                                        🏆 PEAK ({payload.score}%)
                                      </text>
                                      <text x={textX} y={-boxHeight + 23} textAnchor="middle" fill="#F8FAFC" fontSize={8.5} fontWeight={600}>
                                        {truncate(payload.peakTopic)}
                                      </text>
                                    </g>
                                  </g>
                                );
                              }

                              if (isTrough) {
                                const isFirst = index === 0;
                                const isLast = index === rawData.length - 1;
                                const boxWidth = 140;
                                const boxHeight = 34;
                                
                                let rectX = -70;
                                let textX = 0;
                                if (isFirst) { rectX = -10; textX = 60; }
                                else if (isLast) { rectX = -130; textX = -60; }

                                return (
                                  <g key={`dot-trough-${index}`}>
                                    <circle cx={cx} cy={cy} r={9} fill="#F43F5E" fillOpacity={0.25} />
                                    <circle cx={cx} cy={cy} r={5} fill="#F43F5E" stroke="#00243B" strokeWidth={2} />
                                    
                                    <g transform={`translate(${cx}, ${cy + 8})`}>
                                      <polygon points="-5,3 5,3 0,-2" fill="#F43F5E" />
                                      <rect
                                        x={rectX}
                                        y={3}
                                        width={boxWidth}
                                        height={boxHeight}
                                        rx={8}
                                        fill="#00243B"
                                        stroke="#F43F5E"
                                        strokeWidth={1.5}
                                        style={{ filter: "drop-shadow(0px 4px 10px rgba(244, 63, 94, 0.35))" }}
                                      />
                                      <text x={textX} y={17} textAnchor="middle" fill="#F43F5E" fontSize={9} fontWeight={800} letterSpacing="0.5">
                                        ⚠️ TROUGH ({payload.score}%)
                                      </text>
                                      <text x={textX} y={29} textAnchor="middle" fill="#F8FAFC" fontSize={8.5} fontWeight={600}>
                                        {truncate(payload.troughTopic)}
                                      </text>
                                    </g>
                                  </g>
                                );
                              }

                              return (
                                <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="#115D75" stroke="#ffffff" strokeWidth={1.5} />
                              );
                            };

                            return (
                              <motion.div
                                initial={{ clipPath: "inset(0% 100% 0% 0%)" }}
                                animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
                                transition={{ duration: 1.5, ease: "easeInOut", delay: 0.1 }}
                                style={{ width: '100%', height: '100%' }}
                              >
                                <ResponsiveContainer width="100%" height="100%">
                                  <AreaChart
                                    data={rawData}
                                    margin={{ top: 45, right: 15, left: -20, bottom: 20 }}
                                  >
                                    <defs>
                                      <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#115D75" stopOpacity={0.4}/>
                                        <stop offset="95%" stopColor="#115D75" stopOpacity={0}/>
                                      </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                                    <XAxis 
                                      dataKey="name" 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={renderCustomTick} 
                                    />
                                    <YAxis 
                                      axisLine={false} 
                                      tickLine={false} 
                                      tick={{ fontSize: 10, fill: '#64748b' }}
                                    />
                                    <Tooltip 
                                      content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                          const data = payload[0].payload;
                                          const shift = data.percentileShift;
                                          const isPositive = shift > 0;
                                          const isNegative = shift < 0;
                                          const isPeak = data.score === maxScore;
                                          const isTrough = data.score === minScore && !isPeak;

                                          return (
                                            <div className="bg-[#00243B] text-white p-3.5 rounded-2xl border border-slate-700/80 shadow-2xl text-xs space-y-2.5 min-w-[220px] backdrop-blur-md">
                                              <div className="font-bold text-white border-b border-slate-700/80 pb-1.5 flex justify-between items-center gap-2">
                                                <span className="truncate max-w-[120px] font-semibold">{data.title}</span>
                                                {isPeak && (
                                                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full shrink-0">
                                                    🏆 Peak
                                                  </span>
                                                )}
                                                {isTrough && (
                                                  <span className="px-2 py-0.5 text-[9px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/40 rounded-full shrink-0">
                                                    ⚠️ Trough
                                                  </span>
                                                )}
                                                {!isPeak && !isTrough && (
                                                  <span className="text-[10px] text-slate-400 font-medium shrink-0">{data.name}</span>
                                                )}
                                              </div>

                                              <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                                                <div>
                                                  <span className="text-slate-400 text-[10px] block font-medium">{t("Accuracy Score")}</span>
                                                  <span className="font-extrabold text-[#FCB824] text-sm"><AnimatedCounter value={data.score} suffix="%" /></span>
                                                </div>
                                                <div>
                                                  <span className="text-slate-400 text-[10px] block font-medium">{t("AIR Percentile")}</span>
                                                  <span className="font-extrabold text-teal-300 text-sm"><AnimatedCounter value={data.percentile} suffix="%ile" /></span>
                                                </div>
                                              </div>

                                              <div className="bg-slate-800/80 p-2 rounded-xl border border-slate-700/60 text-[11px] space-y-1">
                                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium gap-2">
                                                  <span>{t("Peak Chapter/Topic")}:</span>
                                                  <span className="text-emerald-400 font-bold truncate max-w-[110px]">{data.peakTopic}</span>
                                                </div>
                                                {data.troughTopic && (
                                                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium border-t border-slate-700/50 pt-1 gap-2">
                                                    <span>{t("Key Focus Area")}:</span>
                                                    <span className="text-rose-400 font-bold truncate max-w-[110px]">{data.troughTopic}</span>
                                                  </div>
                                                )}
                                              </div>

                                              <div className="pt-2 border-t border-slate-700/80 flex items-center justify-between">
                                                <span className="text-slate-300 text-[11px] font-medium">{t("Percentile Shift")}:</span>
                                                {!data.hasPrevious ? (
                                                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-slate-800 text-slate-400 rounded-full border border-slate-700">
                                                    {t("Baseline")}
                                                  </span>
                                                ) : (
                                                  <span className={`px-2 py-0.5 text-[11px] font-extrabold rounded-full flex items-center gap-1 border ${
                                                    isPositive 
                                                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' 
                                                      : isNegative 
                                                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                                                      : 'bg-slate-800 text-slate-300 border-slate-700'
                                                  }`}>
                                                    {isPositive ? `▲ +${shift}%` : isNegative ? `▼ ${shift}%` : '0%'}
                                                  </span>
                                                )}
                                              </div>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }}
                                    />
                                    <ReferenceLine 
                                      y={Math.round(attempts.reduce((sum, a) => sum + a.accuracy, 0) / (attempts.length || 1))} 
                                      stroke="#64748b" 
                                      strokeDasharray="3 3" 
                                      label={{ position: 'top', value: 'Avg', fill: '#64748b', fontSize: 10 }} 
                                    />
                                    <ReferenceLine 
                                      y={90} 
                                      stroke="#FCB824" 
                                      strokeDasharray="3 3" 
                                      label={{ position: 'top', value: 'Target 90%', fill: '#FCB824', fontSize: 10 }} 
                                    />
                                    <Area 
                                      type="monotone" 
                                      dataKey="score" 
                                      stroke="#115D75" 
                                      strokeWidth={3}
                                      fillOpacity={1} 
                                      fill="url(#colorScore)" 
                                      dot={renderCustomDot}
                                      activeDot={{ r: 7, fill: '#FCB824', stroke: '#00243B', strokeWidth: 2 }}
                                      isAnimationActive={false}
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              </motion.div>
                            );
                          })() : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{t("No mock tests completed yet.")}</div>
                          )}
                        </motion.div>
                        <div className="flex flex-col sm:flex-row justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4 gap-2">
                          <span>{t("* Trend reflects performance over the last completed sessions")}</span>
                          {attempts.length > 1 && (
                            <span className="text-[var(--teal)] dark:text-amber-300 font-bold flex-shrink-0">
                              {t("Trend: ")}{attempts[0].accuracy > attempts[attempts.length-1].accuracy ? '+' : ''}{attempts[0].accuracy - attempts[attempts.length-1].accuracy}{t("% Improvement")}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      {/* Right Diagnostic metrics card */}
                      <div className="lg:col-span-4 bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm flex flex-col justify-between min-w-0 overflow-hidden">
                        <div>
                          <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-1">{t("Weakness Analysis")}</h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Subject categories with high error densities")}</p>
                          
                          <motion.div 
                            className="space-y-4"
                            initial="hidden"
                            animate="visible"
                            variants={{
                              hidden: { opacity: 0 },
                              visible: {
                                opacity: 1,
                                transition: {
                                  staggerChildren: 0.12,
                                  delayChildren: 0.25
                                }
                              }
                            }}
                          >
                            {attempts.length > 0 && attempts[0].laggingTopics.slice(0, 3).map((topic, i) => (
                              <motion.div 
                                key={i} 
                                variants={{
                                  hidden: { opacity: 0, y: 16, scale: 0.97 },
                                  visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 260, damping: 20 } }
                                }}
                                whileHover={{ scale: 1.02, y: -2 }}
                                className="p-3.5 bg-amber-50/80 dark:bg-[#f59e0b]/10 rounded-2xl border border-amber-200 dark:border-[#f59e0b]/20 flex justify-between items-center gap-2 min-w-0 transition-all shadow-sm hover:shadow-md hover:border-amber-400/50 cursor-pointer"
                              >
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-bold text-[var(--navy)] dark:text-white truncate">{topic.topic}</h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{topic.conceptGap}</p>
                                </div>
                                <span className="text-[10px] font-bold text-amber-700 dark:text-[#f59e0b] bg-amber-100 dark:bg-[#f59e0b]/20 px-2 py-0.5 rounded-md flex-shrink-0">{t("Review")}</span>
                              </motion.div>
                            ))}
                            {attempts.length === 0 && (
                               <motion.div 
                                 variants={{
                                   hidden: { opacity: 0, y: 10 },
                                   visible: { opacity: 1, y: 0 }
                                 }}
                                 className="text-sm text-slate-500"
                               >
                                 {t("Take a mock test to see your weakness analysis.")}
                               </motion.div>
                            )}
                          </motion.div>
                        </div>

                        <button 
                          onClick={() => {
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
                          className="print:hidden w-full mt-6 py-3.5 bg-[var(--teal)] hover:bg-[var(--teal-2)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer text-center"
                        >{t("Generate AI Revision Sheets")}</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
                      {/* Time Spent per Question Chart */}
                      <div className="bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
                        <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Pacing Diagnostics")}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Average time spent per question across subjects (seconds)")}</p>
                        
                        <motion.div 
                          className="h-64 pt-6 border-b border-slate-200 dark:border-slate-700 pb-2 w-full"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                        >
                          {timeSpentData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={timeSpentData}
                                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                barSize={40}
                              >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                                <XAxis 
                                  dataKey="subject" 
                                  axisLine={false}
                                  tickLine={false}
                                  tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }}
                                  dy={10}
                                />
                                <YAxis 
                                  axisLine={false}
                                  tickLine={false} 
                                  tick={{ fontSize: 10, fill: '#64748b' }}
                                />
                                <Tooltip 
                                  cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                  contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', fontSize: '12px', backgroundColor: '#00243B', color: '#fff' }}
                                  itemStyle={{ color: '#FCB824', fontWeight: 'bold' }}
                                  formatter={(value: number) => [`${value}s`, 'Avg. Time']}
                                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                />
                                <Bar dataKey="avgTime" radius={[6, 6, 0, 0]}>
                                  {timeSpentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.subject === 'Physics' ? '#FCB824' : entry.subject === 'Chemistry' ? '#1A7A99' : '#115D75'} />
                                  ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{t("Not enough data to analyze pacing.")}</div>
                          )}
                        </motion.div>
                        <div className="flex flex-col sm:flex-row justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4 gap-2">
                          <span>{t("* Ideal pacing is < 60s for Biology, < 90s for Chemistry, and < 120s for Physics")}</span>
                        </div>
                      </div>

                      {/* Subject Performance Radar */}
                      <div className="bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
                        <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Subject Mastery Radar")}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Performance balance across core subjects")}</p>
                        
                        <motion.div 
                          className="h-64 pt-2 border-b border-slate-200 dark:border-slate-700 pb-2 w-full flex items-center justify-center"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.3 }}
                        >
                          {radarData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                                <PolarGrid stroke="rgba(148, 163, 184, 0.2)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 'bold' }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar name="Score" dataKey="score" stroke="#FCB824" fill="#FCB824" fillOpacity={0.6} />
                                <Tooltip
                                  contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', fontSize: '12px', backgroundColor: '#00243B', color: '#fff' }}
                                  itemStyle={{ color: '#FCB824', fontWeight: 'bold' }}
                                  labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
                                  formatter={(value: number) => [`${value}%`, 'Score']}
                                />
                              </RadarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sm text-slate-500">{t("Not enough data to analyze subjects.")}</div>
                          )}
                        </motion.div>
                        <div className="flex flex-col sm:flex-row justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 mt-4 gap-2">
                          <span>{t("* Maps relative strength (0-100 scale)")}</span>
                        </div>
                      </div>
                    </div>


                  </div>
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
                  <button onClick={() => { setTab("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">{t("Dashboard")}</button>
                  <button onClick={() => { setTab("course"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">Courses</button>
                  <button onClick={() => { setTab("tests"); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-sm text-slate-300 hover:text-[#FCB824] transition-colors cursor-pointer text-left">Test Series</button>
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
