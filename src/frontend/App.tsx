import React, { useState, useMemo } from "react";
import { useLanguage } from "./contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
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
import LumenLogo from "./components/common/LumenLogo";
import logoImg from "./assets/logo.png";
import CourseAreaView from "./components/views/CourseAreaView";

import AdminView from "./components/views/AdminView";

export default function App() {
  const { t } = useLanguage();
  const [hasSeenSplash, setHasSeenSplash] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [studentName, setStudentName] = useState("Prince A");
  const [attempts, setAttempts] = useState<TestAttempt[]>(INITIAL_ATTEMPTS);
  const [activeAttemptId, setActiveAttemptId] = useState<string>("mock_04");
  const [currentTab, setTab] = useState<string>("dashboard");

  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentTab]);
  const [currentScreen, setCurrentScreen] = useState<"portal" | "system_check" | "lobby" | "test_taking" | "evaluating">("portal");
  const [customTestConfig, setCustomTestConfig] = useState<{
    title: string;
    questions: Question[];
    durationSeconds: number;
    mode: "proctored" | "standard" | "practice";
    subject: string;
  } | null>(null);
  const [exploredCourse, setExploredCourse] = useState<"physics" | "chemistry" | "biology" | null>(null);

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

  // Enters proctored exam taking environment
  const handleStartTest = () => {
    setCurrentScreen("test_taking");
  };

  // Executed when user finishes proctored test taking
  const handleCompleteTest = (
    selectedAnswers: { [key: number]: number },
    flaggedQuestions: number[],
    timeMap: Record<number, number>
  ) => {
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
      
      {/* If taking a test, show full proctored window instead of regular app shell */}
      {currentScreen === "test_taking" ? (
        <TestTakingView
          studentName={studentName}
          onCancel={() => {
            setCustomTestConfig(null);
            setCurrentScreen("portal");
          }}
          onCompleteTest={handleCompleteTest}
          customQuestions={fallbackQuestions}
          customDurationSeconds={activeDurationSeconds}
          customTitle={customTestConfig ? customTestConfig.title : activeAttempt.title}
          customMode="standard"
        />
      ) : currentScreen === "evaluating" ? (
        <EvaluatingView onEvaluationComplete={handleEvaluationComplete} />
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
            onSignOut={() => setIsAuthenticated(false)}
          />

          {/* Core Content Container */}
          <main className="flex-1 pt-44 lg:pt-32 pb-16 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full">
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
                  <div className="space-y-8 animate-in fade-in duration-500">
                    <div className="px-2">
                      <h2 className="text-2xl md:text-3xl font-sans font-bold text-slate-900 dark:text-white tracking-tight mb-1">{t("Deep Diagnostics & Analytics")}</h2>
                      <p className="text-slate-600 dark:text-slate-300 text-sm">{t("Granular performance tracking and trends over your last completed mock sessions.")}</p>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                      {/* Left graph container card */}
                      <div className="lg:col-span-8 bg-white dark:bg-[var(--navy)] text-[var(--navy)] dark:text-white rounded-[32px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm overflow-hidden min-w-0">
                        <h3 className="font-bold text-lg text-[var(--navy)] dark:text-white mb-2">{t("Trend Evaluation Overview")}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">{t("Overall percentile and total correct score distribution")}</p>
                        
                        {/* Interactive customized visual bar graphs */}
                        <div className="h-64 flex items-end justify-between gap-2 sm:gap-4 md:gap-6 pt-6 border-b border-slate-200 dark:border-slate-700 pb-2 overflow-x-auto min-w-0 w-full">
                          {[...attempts].reverse().slice(-5).map((attempt, idx) => {
                            const formattedDate = attempt.date ? (attempt.date.includes('T') ? attempt.date.split('T')[0] : attempt.date) : 'Recent';
                            return (
                              <div key={attempt.id} className="flex-1 min-w-[60px] max-w-[120px] flex flex-col items-center gap-2 min-w-0">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-full" title={formattedDate}>{formattedDate}</span>
                                <div className="w-full bg-[var(--teal)]/10 rounded-t-xl relative group cursor-pointer hover:bg-[var(--teal)]/20 transition-all flex items-end h-36">
                                  <div className="w-full bg-[var(--teal)] rounded-t-xl text-[10px] text-white font-bold text-center flex items-center justify-center transition-all duration-300" style={{ height: Math.max(12, attempt.accuracy) + '%' }}>
                                    {attempt.accuracy}%
                                  </div>
                                </div>
                                <span className="text-[10px] sm:text-xs font-bold text-[var(--navy)] dark:text-white truncate max-w-full text-center" title={attempt.title}>{attempt.title}</span>
                              </div>
                            );
                          })}
                          {attempts.length === 0 && (
                            <div className="w-full text-center text-sm text-slate-500">{t("No mock tests completed yet.")}</div>
                          )}
                        </div>
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
                          
                          <div className="space-y-4">
                            {attempts.length > 0 && attempts[0].laggingTopics.slice(0, 3).map((topic, i) => (
                              <div key={i} className="p-3.5 bg-amber-50/80 dark:bg-[#f59e0b]/10 rounded-2xl border border-amber-200 dark:border-[#f59e0b]/20 flex justify-between items-center gap-2 min-w-0">
                                <div className="min-w-0 flex-1">
                                  <h4 className="text-xs font-bold text-[var(--navy)] dark:text-white truncate">{topic.topic}</h4>
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">{topic.conceptGap}</p>
                                </div>
                                <span className="text-[10px] font-bold text-amber-700 dark:text-[#f59e0b] bg-amber-100 dark:bg-[#f59e0b]/20 px-2 py-0.5 rounded-md flex-shrink-0">{t("Review")}</span>
                              </div>
                            ))}
                            {attempts.length === 0 && (
                               <div className="text-sm text-slate-500">{t("Take a mock test to see your weakness analysis.")}</div>
                            )}
                          </div>
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
                          className="w-full mt-6 py-3.5 bg-[var(--teal)] hover:bg-[var(--teal-2)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer text-center"
                        >{t("Generate AI Revision Sheets")}</button>
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
          <footer className="w-full py-12 px-6 md:px-12 bg-gradient-to-br from-[var(--navy)] via-[var(--navy)] to-[var(--navy)] border-t border-[#FCB824]/20 flex flex-col items-center">
            <div className="w-full max-w-[1280px] flex flex-col md:flex-row justify-between items-center gap-8 mb-10">
              <div className="flex flex-col gap-2 text-center md:text-left">
                <div className="flex items-center gap-3 md:gap-3.5 justify-center md:justify-start">
                  <img 
                    src={logoImg} 
                    alt="Lumen Academy" 
                    className="h-[42px] sm:h-[50px] md:h-[56px] w-auto object-contain shrink-0"
                  />
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
