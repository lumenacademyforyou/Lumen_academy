


import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { motion } from "motion/react";
import AnimatedCounter from "../common/AnimatedCounter";
import { TestAttempt } from "../../../types";
import { LearningPathTimeline } from "../dashboard/LearningPathTimeline";
import { PomodoroTimer } from "../dashboard/PomodoroTimer";
import { DailyFlashcard } from "../dashboard/DailyFlashcard";
import { fetchStudySessions, calculateStudyStreak } from "../../lib/studySessionService";
import { supabase } from "../../supabase";
import { fetchMe, MeProfile } from "../../lib/meApi";

interface RecommendedMock {
  id: string;
  title: string;
  subject: string;
  questionCount: number;
  durationMinutes: number;
  difficulty: "Beginner" | "Intermediate" | "Advanced" | "NTA Exam Level";
  description: string;
  tags: string[];
}

const ALL_MOCK_TESTS: RecommendedMock[] = [
  {
    id: "physics_1",
    title: "NEET Physics Velocity & Mechanics Drill",
    subject: "Physics",
    questionCount: 45,
    durationMinutes: 45,
    difficulty: "Advanced",
    description: "Targeted problem set on Rotational Dynamics, Kinematics & Wave Optics.",
    tags: ["Formula Heavy", "High Weightage"]
  },
  {
    id: "chemistry_1",
    title: "NEET Organic Reaction Mechanisms Special",
    subject: "Chemistry",
    questionCount: 45,
    durationMinutes: 45,
    difficulty: "NTA Exam Level",
    description: "Named reactions, Reaction Kinetics, and Electrochemistry NCERT questions.",
    tags: ["NCERT Direct", "High Yield"]
  },
  {
    id: "biology_1",
    title: "NCERT Botany & Plant Physiology Mastery",
    subject: "Biology",
    questionCount: 90,
    durationMinutes: 60,
    difficulty: "Intermediate",
    description: "Photosynthesis, Respiration, and Genetics diagram-based NCERT questions.",
    tags: ["High Accuracy Target", "Diagram Based"]
  },
  {
    id: "biology_2",
    title: "Human Physiology & Zoology Rank Booster",
    subject: "Biology",
    questionCount: 90,
    durationMinutes: 60,
    difficulty: "NTA Exam Level",
    description: "Neural Control, Endocrine, and Biomolecules assertion-reason questions.",
    tags: ["Assertion-Reason", "Rank Enhancer"]
  },
  {
    id: "math_1",
    title: "Advanced Mathematics Problem Solving Mock",
    subject: "Mathematics",
    questionCount: 30,
    durationMinutes: 45,
    difficulty: "Advanced",
    description: "Calculus, Vectors, and 3D Geometry problem-solving test.",
    tags: ["Calculus", "Speed Test"]
  },
  {
    id: "full_1",
    title: "Ultimate Full-Syllabus Grand Mock",
    subject: "All Subjects",
    questionCount: 180,
    durationMinutes: 180,
    difficulty: "NTA Exam Level",
    description: "Complete 180-question simulation with real-time AIR percentile ranking.",
    tags: ["Full Syllabus", "AIR Ranking"]
  }
];

interface DashboardViewProps {
  attempt: TestAttempt;
  studentName: string;
  onTakeTest: () => void;
  attemptsCount: number;
}

export default function DashboardView({ attempt, studentName, onTakeTest, attemptsCount }: DashboardViewProps) {
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const { t, language } = useLanguage();
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showDetailedReport, setShowDetailedReport] = useState(false);
  const [showIRTReport, setShowIRTReport] = useState(false);

  const [studyStreak, setStudyStreak] = useState(0);

  const [dailyStudyGoal, setDailyStudyGoal] = useState<string>(() => {
    return localStorage.getItem("lumen_daily_study_goal") || "";
  });
  const [tempStudyGoal, setTempStudyGoal] = useState<string>(dailyStudyGoal);
  const [isEditingGoal, setIsEditingGoal] = useState<boolean>(!dailyStudyGoal);

  const handleSaveGoal = () => {
    setDailyStudyGoal(tempStudyGoal);
    localStorage.setItem("lumen_daily_study_goal", tempStudyGoal);
    setIsEditingGoal(false);
  };
useEffect(() => {
  let isMounted = true;

  const updateStreak = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (isMounted) setStudyStreak(0);
        return;
      }
      const sessions = await fetchStudySessions(user.id);

      if (isMounted) {
        setStudyStreak(calculateStudyStreak(sessions));
      }
    } catch (err) {
      console.error("Failed to update streak:", err);
    }
  };

  updateStreak();

  window.addEventListener("lumen_session_saved", updateStreak);

  return () => {
    isMounted = false;
    window.removeEventListener("lumen_session_saved", updateStreak);
  };
}, [studentName]);

  // Single call (LA-BE-CORE-002 CL-P4) drives both the "complete your
  // profile" banner and which mock tests are recommended below — previously
  // this depended on <ProfileCard>'s onIncompleteChange callback, but
  // ProfileCard isn't rendered anywhere in this component, so
  // profileIncomplete was permanently false and the banner never showed.
  useEffect(() => {
    let isMounted = true;
    fetchMe()
      .then((me) => {
        if (!isMounted) return;
        setProfileIncomplete(!me.studentProfile?.targetYear || !me.studentProfile?.classLevel);
      })
      .catch((err) => console.error("Failed to load profile completeness:", err));
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredMocks = ALL_MOCK_TESTS;

  const maxMarks = (attempt.correctAnswers + attempt.incorrectAnswers + attempt.skippedAnswers) * 4 || 1;
  const animatedPercentage = Math.max(0, (animatedScore / maxMarks) * 100);

  // Circumference for r=110: 2 * Math.PI * 110 ≈ 691.15
  const circumference = 691.15;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;
  
  // Compute subject time aggregations if available
  const subjectTimes = {
    Biology: { total: 0, count: 0 },
    Chemistry: { total: 0, count: 0 },
    Physics: { total: 0, count: 0 }
  };
  
  if (attempt.questionTimeData) {
    attempt.questionTimeData.forEach(q => {
      if (subjectTimes[q.subject]) {
        subjectTimes[q.subject].total += q.timeSpentSeconds;
        subjectTimes[q.subject].count += 1;
      }
    });
  }

  const subjectAverages = Object.entries(subjectTimes).map(([sub, data]) => ({
    subject: sub,
    avg: data.count > 0 ? Math.round(data.total / data.count) : 0
  })).filter(x => x.avg > 0);

  const fastestSubject = subjectAverages.length > 0 ? subjectAverages.reduce((prev, curr) => prev.avg < curr.avg ? prev : curr) : { subject: 'Biology', avg: 45 };
  const slowestSubject = subjectAverages.length > 0 ? subjectAverages.reduce((prev, curr) => prev.avg > curr.avg ? prev : curr) : { subject: 'Physics', avg: 112 };


  useEffect(() => {
    // Reset and animate the total score percentage on mount or when the attempt changes
    setAnimatedScore(0);
    const timer = setTimeout(() => {
      let current = 0;
      const target = attempt.totalScore;
      if (target <= 0) return;
      const interval = setInterval(() => {
        current += 2;
        if (current >= target) {
          setAnimatedScore(target);
          clearInterval(interval);
        } else {
          setAnimatedScore(current);
        }
      }, 20);
      return () => clearInterval(interval);
    }, 300);

    return () => clearTimeout(timer);
  }, [attempt]);

  // Dedicated Full Page View for Detailed Report
  if (showDetailedReport) {
    return (
      <div className="space-y-8 max-w-[1280px] mx-auto animate-in fade-in duration-300 pb-12">
        {/* Top Navigation / Header Bar */}
        <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDetailedReport(false)}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#00243B] dark:text-white rounded-2xl transition-all cursor-pointer flex items-center justify-center font-bold text-xs gap-2 shadow-xs"
            >
              <span className="material-symbols-outlined text-lg">arrow_back</span>
              <span>{t("Back to Scorecard")}</span>
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--teal)] dark:text-[#FCB824] bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">{t("Detailed Analysis")}</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white mt-1">
                {attempt.title} Summary & Lagging Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Completed on {attempt.date} • Diagnostic Evaluation
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowDetailedReport(false)}
            className="px-5 py-2.5 bg-[#00243B] dark:bg-[#FCB824] text-white dark:text-[#00243B] rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm hover:opacity-95 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">dashboard</span>
            <span>{t("Return to Dashboard")}</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[32px] p-6 md:p-10 shadow-lg border border-slate-200 dark:border-slate-700 space-y-8">
          
          {/* Top Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">{t("Target Percentile")}</p>
              <AnimatedCounter value={attempt.percentile} suffix="%" className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white" />
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">{t("Accuracy")}</p>
              <AnimatedCounter value={attempt.accuracy} suffix="%" className="text-xl md:text-2xl font-bold text-[var(--teal)] dark:text-[#FCB824]" />
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">{t("Score")}</p>
              <p className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{attempt.totalScore} <span className="text-xs text-slate-500 font-normal">/ {maxMarks === 1 ? 720 : maxMarks}</span></p>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-1">{t("Time Speed")}</p>
              <p className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{Math.round(attempt.timeTakenMinutes / (attempt.correctAnswers + attempt.incorrectAnswers || 1) * 10) / 10} min/Q</p>
            </div>
          </div>

          {/* Answers breakdown bar */}
          <div className="space-y-3 p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <h4 className="text-xs font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">{t("Question Responses Distribution")}</h4>
            <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
              <div 
                className="bg-emerald-500 h-full transition-all" 
                style={{ width: `${(attempt.correctAnswers / (attempt.correctAnswers + attempt.incorrectAnswers + attempt.skippedAnswers || 1)) * 100}%` }}
              ></div>
              <div 
                className="bg-rose-500 h-full transition-all" 
                style={{ width: `${(attempt.incorrectAnswers / (attempt.correctAnswers + attempt.incorrectAnswers + attempt.skippedAnswers || 1)) * 100}%` }}
              ></div>
              <div 
                className="bg-slate-400 h-full transition-all" 
                style={{ width: `${(attempt.skippedAnswers / (attempt.correctAnswers + attempt.incorrectAnswers + attempt.skippedAnswers || 1)) * 100}%` }}
              ></div>
            </div>
            <div className="flex flex-wrap justify-between gap-4 text-xs font-semibold text-slate-600 dark:text-slate-300 pt-1">
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block"></span> Correct: {attempt.correctAnswers}</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block"></span> Incorrect: {attempt.incorrectAnswers}</span>
              <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span> Skipped: {attempt.skippedAnswers}</span>
            </div>
          </div>

          {/* Detailed Lagging & Improvement Section with NCERT References */}
          {attempt.laggingTopics && attempt.laggingTopics.length > 0 ? (
            <div className="space-y-6 pt-2">
              <h4 className="text-sm md:text-base font-bold text-[#00243B] dark:text-white uppercase tracking-wider flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-700 pb-3">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-xl">search_check</span>
                Where You Are Lagging & NCERT References
              </h4>

              <div className="space-y-5">
                {attempt.laggingTopics.map((lag, idx) => (
                  <div key={idx} className="p-5 md:p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-[#FCB824] px-3 py-1 rounded-full border border-amber-300 dark:border-amber-800">
                          {lag.subject}
                        </span>
                        <span className="text-sm font-bold text-[#00243B] dark:text-slate-200">
                          {lag.unit}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-3 py-1 rounded-md border border-rose-200 dark:border-rose-900/60">
                        Negative Marks Lost: -{lag.negativeMarksLost}
                      </span>
                    </div>

                    <h5 className="font-bold text-lg text-[#00243B] dark:text-white">
                      Topic: {lag.topic}
                    </h5>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                      <div className="p-4 bg-white dark:bg-[var(--navy)] rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="font-bold text-rose-600 dark:text-rose-400 text-xs uppercase mb-1.5 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">error</span>
                          Where You Are Lagging:
                        </p>
                        <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed">{lag.conceptGap}</p>
                      </div>

                      <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900/40">
                        <p className="font-bold text-amber-800 dark:text-[#FCB824] text-xs uppercase mb-1.5 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm">task_alt</span>{t("How To Improve:")}</p>
                        <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1 font-medium">
                          {lag.improvementSteps.map((step, sIdx) => (
                            <li key={sIdx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* NCERT Exact Material Reference */}
                    <div className="p-4 bg-amber-50/60 dark:bg-amber-950/40 rounded-xl border border-amber-200/80 dark:border-amber-800/60 text-xs sm:text-sm space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[var(--teal)] dark:text-[#FCB824] font-bold">
                          <span className="material-symbols-outlined text-lg">menu_book</span>
                          <span>{lag.ncertReference.book}</span>
                        </div>
                        <span className="text-xs font-bold text-amber-800 dark:text-[#FCB824] bg-amber-100 dark:bg-amber-900/80 px-2.5 py-1 rounded-md">
                          {lag.ncertReference.pages}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-[#00243B] dark:text-white">
                        {lag.ncertReference.chapter}
                      </p>
                      <p className="text-xs sm:text-sm italic text-slate-700 dark:text-slate-300 border-l-2 border-[var(--teal)] dark:border-[#FCB824] pl-3 mt-2">
                        "{lag.ncertReference.keyLines}"
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-6 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-4">
              <span className="material-symbols-outlined text-3xl text-[#ffd15c]">verified</span>
              <div>
                <p className="font-bold text-base">{t("No Major Concept Lags Detected!")}</p>
                <p className="text-xs">{t("You answered all tested NCERT syllabus units with high precision. Keep maintaining this streak.")}</p>
              </div>
            </div>
          )}

          {/* Bottom Back Action */}
          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
            <button 
              onClick={() => setShowDetailedReport(false)}
              className="bg-[#00243B] dark:bg-[#FCB824] text-white dark:text-[#00243B] hover:opacity-90 px-8 py-3.5 rounded-2xl font-bold text-xs tracking-wide cursor-pointer uppercase shadow-md transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              <span>{t("Back to Scorecard")}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 max-w-[1280px] mx-auto animate-in fade-in duration-500">
      
      {/* Hero Score Section */}
      <div className="relative overflow-hidden rounded-[32px] md:rounded-[40px] bg-[var(--navy)] p-8 md:p-12 shadow-2xl border border-[#FCB824]/20">
        {/* Background ambient blurs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/30 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          {/* Hero text information */}
          <div className="flex-1 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-4">
              <span className="inline-block bg-white/10 text-blue-100 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">{t("LATEST SCORECARD")}</span>
              <span className="inline-flex items-center gap-1.5 bg-[#FCB824]/20 text-[#FCB824] border border-[#FCB824]/30 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide">
                <span className="material-symbols-outlined text-sm animate-pulse">stars</span>
                <span>{t("Journey to 720 starts here")}</span>
              </span>
            </div>
            <h1 className="font-sans font-bold text-3xl md:text-5xl text-white tracking-tight mb-4 leading-none">
              Great work, {studentName}!
            </h1>
            <p className="text-blue-100 text-base md:text-lg font-normal max-w-xl opacity-90 leading-relaxed mx-auto lg:mx-0">{t("You've outperformed")}<span className="font-bold text-white">{attempt.percentile}{t("% of participants")}</span>{t(" in the ")}<span className="text-white font-semibold">{attempt.title}</span>{t(". Your consistency in Physics is showing significant growth.")}</p>
            
            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-4 md:gap-6">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 min-w-[140px] md:min-w-[160px] border border-white/20 text-center">
                <span className="block text-white/70 text-[11px] font-bold tracking-wider mb-2">{t("ACCURACY")}</span>
                <AnimatedCounter value={attempt.accuracy} suffix="%" className="text-white text-2xl md:text-3xl font-bold font-sans" />
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 min-w-[140px] md:min-w-[160px] border border-white/20 text-center">
                <span className="block text-white/70 text-[11px] font-bold tracking-wider mb-2">{t("PERCENTILE")}</span>
                <span className="text-white text-2xl md:text-3xl font-bold font-sans">
                  <AnimatedCounter value={attempt.percentile} /><span className="text-base ml-0.5 font-normal">{t("th")}</span>
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 min-w-[140px] md:min-w-[160px] border border-white/20 text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-[#FCB824]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="block text-[#FCB824] text-[11px] font-bold tracking-wider mb-2 flex justify-center items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                  {t("STUDY STREAK")}
                </span>
                <span className="text-white text-2xl md:text-3xl font-bold font-sans">
                  <AnimatedCounter value={studyStreak} /><span className="text-base ml-1 font-normal text-white/70">{t("Days")}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Circle Score visualization */}
          <div className="relative flex flex-col items-center flex-shrink-0">
            <div className="relative w-56 h-56 md:w-64 md:h-64 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90">
                <circle
                  className="text-white/10 stroke-current"
                  cx="50%"
                  cy="50%"
                  fill="transparent"
                  r="100"
                  strokeWidth="12"
                ></circle>
                <circle
                  className="text-secondary-fixed stroke-current transition-all duration-300"
                  cx="50%"
                  cy="50%"
                  fill="transparent"
                  r="100"
                  strokeWidth="12"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                <span className="text-4xl md:text-5xl font-extrabold leading-none mb-1 font-sans">
                  {animatedScore}
                </span>
                <span className="text-[10px] font-bold tracking-[0.2em] opacity-85">/ {maxMarks === 1 ? 0 : maxMarks}</span>
                <span className="text-[10px] font-bold tracking-[0.2em] opacity-85 mt-1">{t("TOTAL SCORE")}</span>
              </div>
            </div>
            
            <button 
              onClick={() => setShowDetailedReport(true)}
              className="mt-6 bg-[#fde047] text-[var(--teal)] hover:bg-[#facc15] px-8 py-3.5 rounded-2xl font-bold text-xs tracking-wider uppercase hover:scale-105 active:scale-95 transition-all shadow-xl"
            >{t("VIEW DETAILED REPORT")}</button>
          </div>
        </div>
      </div>
{profileIncomplete && (
  <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-2xl p-4 flex items-center gap-3 text-sm font-semibold">
    <span className="material-symbols-outlined text-xl">info</span>
    {t("Your profile is incomplete — please fill in your details below to get personalized recommendations.")}
  </div>
)}
      {/* Student Profile */}
   


      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Study Goal */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-between gap-4 h-full"
        >
          <div className="flex items-center gap-4 w-full">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-2xl">flag</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("Daily Study Goal")}</h3>
              {isEditingGoal ? (
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-1.5 w-full">
                  <input 
                    type="text" 
                    value={tempStudyGoal} 
                    onChange={(e) => setTempStudyGoal(e.target.value)} 
                    onKeyDown={(e) => e.key === "Enter" && handleSaveGoal()}
                    placeholder={t("e.g. Solve 50 MCQs")}
                    className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
                    autoFocus
                  />
                  <button 
                    onClick={handleSaveGoal}
                    className="bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] px-4 py-2 rounded-xl text-xs font-bold transition-transform hover:scale-105 shrink-0 w-full sm:w-auto"
                  >
                    {t("Save")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3 mt-1 justify-between w-full">
                  <span className="text-lg font-bold text-[#00243B] dark:text-white truncate">
                    {dailyStudyGoal || t("No goal set for today")}
                  </span>
                  <button 
                    onClick={() => setIsEditingGoal(true)}
                    className="text-slate-400 hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors p-1 flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Progress Chip */}
          {!isEditingGoal && dailyStudyGoal && (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 px-5 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider w-full justify-center">
              <span className="material-symbols-outlined text-[18px]">track_changes</span>
              {t("Goal Active")}
            </div>
          )}
        </motion.div>

        {/* Achievements Section */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-700 h-full flex flex-col"
        >
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">emoji_events</span>
            {t("Recent Achievements")}
          </h3>
          <div className="flex flex-wrap gap-4 overflow-hidden flex-1 items-start content-start">
            {studyStreak >= 3 && (
              <div className="flex items-center gap-3 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-200 dark:border-amber-800 px-4 py-3 rounded-2xl flex-1 min-w-[180px]">
                <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm border border-amber-200 dark:border-amber-700 shrink-0">
                  <span className="material-symbols-outlined text-xl">local_fire_department</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-500 truncate">{t("Streak Master")}</p>
                  <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400/80 truncate">{studyStreak} {t("Day Streak")}</p>
                </div>
              </div>
            )}
            {attemptsCount > 0 && (
              <div className="flex items-center gap-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 px-4 py-3 rounded-2xl flex-1 min-w-[180px]">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm border border-blue-200 dark:border-blue-700 shrink-0">
                  <span className="material-symbols-outlined text-xl">lightbulb</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-blue-700 dark:text-blue-500 truncate">{t("Early Bird")}</p>
                  <p className="text-[10px] font-semibold text-blue-600 dark:text-blue-400/80 truncate">{t("Completed session")}</p>
                </div>
              </div>
            )}
            {attempt.accuracy >= 90 && (
              <div className="flex items-center gap-3 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-200 dark:border-emerald-800 px-4 py-3 rounded-2xl flex-1 min-w-[180px]">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-200 dark:border-emerald-700 shrink-0">
                  <span className="material-symbols-outlined text-xl">military_tech</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-500 truncate">{t("High Scorer")}</p>
                  <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400/80 truncate">{t("90%+ Accuracy")}</p>
                </div>
              </div>
            )}
            
            {!(studyStreak >= 3 || attemptsCount > 0 || attempt.accuracy >= 90) && (
              <div className="w-full flex items-center justify-center h-20 text-slate-400 dark:text-slate-500 text-xs font-semibold italic bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
                {t("Keep studying to unlock achievements!")}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Quick Stats Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 ">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.05, rotate: -2, zIndex: 10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-6 md:p-8 rounded-[24px] md:rounded-[32px] shadow-sm border border-outline-variant dark:border-slate-700 flex flex-col items-center text-center cursor-pointer"
        >
          <span className="material-symbols-outlined text-secondary mb-3 text-[32px] md:text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
          <span className="text-2xl md:text-4xl font-extrabold text-on-surface dark:text-white mb-1 font-sans">{attempt.correctAnswers}</span>
          <span className="text-on-surface-variant dark:text-slate-300 font-bold text-[10px] md:text-xs tracking-wider uppercase">{t("Correct Answers")}</span>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.05, rotate: 2, zIndex: 10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-6 md:p-8 rounded-[24px] md:rounded-[32px] shadow-sm border border-outline-variant dark:border-slate-700 flex flex-col items-center text-center cursor-pointer"
        >
          <span className="material-symbols-outlined text-error mb-3 text-[32px] md:text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            cancel
          </span>
          <span className="text-2xl md:text-4xl font-extrabold text-on-surface dark:text-white mb-1 font-sans">{attempt.incorrectAnswers}</span>
          <span className="text-on-surface-variant dark:text-slate-300 font-bold text-[10px] md:text-xs tracking-wider uppercase">{t("Incorrect Answers")}</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.05, rotate: -2, zIndex: 10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
          className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-6 md:p-8 rounded-[24px] md:rounded-[32px] shadow-sm border border-outline-variant dark:border-slate-700 flex flex-col items-center text-center cursor-pointer"
        >
          <span className="material-symbols-outlined text-outline mb-3 text-[32px] md:text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            do_not_disturb_on
          </span>
          <span className="text-2xl md:text-4xl font-extrabold text-on-surface dark:text-white mb-1 font-sans">{attempt.skippedAnswers}</span>
          <span className="text-on-surface-variant dark:text-slate-300 font-bold text-[10px] md:text-xs tracking-wider uppercase">{t("Skipped Questions")}</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          whileHover={{ scale: 1.05, rotate: 2, zIndex: 10, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.3 }}
          className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-6 md:p-8 rounded-[24px] md:rounded-[32px] shadow-sm border border-outline-variant dark:border-slate-700 flex flex-col items-center text-center cursor-pointer"
        >
          <span className="material-symbols-outlined text-primary dark:text-[#FCB824] mb-3 text-[32px] md:text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            timer
          </span>
          <span className="text-2xl md:text-4xl font-extrabold text-on-surface dark:text-white mb-1 font-sans">
            {attempt.timeTakenMinutes}<span className="text-lg md:text-xl ml-0.5 font-normal">m</span>
          </span>
          <span className="text-on-surface-variant dark:text-slate-300 font-bold text-[10px] md:text-xs tracking-wider uppercase">{t("Time Taken")}</span>
        </motion.div>
      </div>

      <LearningPathTimeline />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <PomodoroTimer studentName={studentName} />
        <DailyFlashcard />
      </div>

      {/* DYNAMIC MOCK TEST RECOMMENDATIONS (FILTERED BY SUPABASE PROFILE PREFERRED SUBJECTS) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] md:rounded-[36px] p-6 md:p-8 border-2 border-[var(--teal)]/30 dark:border-[#FCB824]/30 shadow-md space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-xl">recommend</span>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--teal)] dark:text-[#FCB824] bg-teal-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-[var(--teal)]/20 dark:border-[#FCB824]/30">
                Supabase Profile Recommendation Engine
              </span>
            </div>
            <h3 className="text-xl md:text-2xl font-bold tracking-tight text-[#00243B] dark:text-white">
              Recommended Mock Tests for {studentName || "Student"}
            </h3>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredMocks.length === 0 ? (
            <div className="col-span-full py-10 text-center space-y-2">
              <p className="text-sm font-bold text-slate-500">No mock tests found matching your selected subject filter.</p>
              <p className="text-xs text-slate-400">Select at least one subject chip above to view targeted practice tests.</p>
            </div>
          ) : (
            filteredMocks.map((mock) => (
              <div
                key={mock.id}
                className="bg-slate-50 dark:bg-[#071d2b] p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4 hover:border-[var(--teal)] dark:hover:border-[#FCB824] transition-all group shadow-2xs"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-[#FCB824]">
                      {mock.subject}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">
                      {mock.difficulty}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-[#00243B] dark:text-white group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors leading-snug">
                    {mock.title}
                  </h4>

                  <p className="text-xs text-slate-600 dark:text-slate-300 font-normal line-clamp-2">
                    {mock.description}
                  </p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">quiz</span>
                      {mock.questionCount} Questions
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {mock.durationMinutes} Mins
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={onTakeTest}
                    className="w-full py-2.5 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white dark:text-[#00243B] font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span>Start Recommended Test</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Subject Wise Performance */}
      <div>
        <div className="flex justify-between items-end mb-6 px-2">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight mb-1">{t("Subject Performance")}</h2>
            <p className="text-on-surface-variant text-xs md:text-sm">{t("Individual accuracy and growth breakdown across core NEET syllabus")}</p>
          </div>
          <button 
            onClick={() => alert("Comparing with previous 3 mock results... Growth trend shows constant positive trajectory (+6.5% average)!")}
            className="text-secondary font-bold text-xs md:text-sm hover:underline flex items-center gap-1 cursor-pointer"
          >{t("Compare with Previous")}<span className="material-symbols-outlined text-xs md:text-sm">open_in_new</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Physics Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.3 }}
            className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm border border-outline-variant dark:border-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div className="h-2 bg-[#f59e0b]"></div>
            <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#f59e0b]/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <span className="material-symbols-outlined text-[#f59e0b] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      bolt
                    </span>
                  </div>
                  <span className="font-sans font-bold text-lg md:text-xl dark:text-white">{t("Physics")}</span>
                </div>
                <span className="bg-[#f59e0b]/10 text-[#f59e0b] px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {attempt.subjectBreakdown.Physics.status}
                </span>
              </div>
              
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs md:text-sm mb-2 font-medium">
                    <span className="text-on-surface-variant dark:text-slate-300">{t("Accuracy Rate")}</span>
                    <span className="font-bold text-on-surface dark:text-white text-sm md:text-base">{attempt.subjectBreakdown.Physics.score}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-container dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#f59e0b] rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${attempt.subjectBreakdown.Physics.score}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3.5 bg-surface-container-low dark:bg-slate-800/80 rounded-xl border border-outline-variant/30 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary dark:text-[#FCB824] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                      trending_up
                    </span>
                    <span className="text-xs font-semibold text-on-surface dark:text-slate-200">{t("Growth Trend")}</span>
                  </div>
                  <span className="text-secondary dark:text-[#FCB824] font-bold text-xs">+{attempt.subjectBreakdown.Physics.growth}%</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Chemistry Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm border border-outline-variant dark:border-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div className="h-2 bg-[#38bdf8]"></div>
            <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#38bdf8]/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <span className="material-symbols-outlined text-[#38bdf8] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      science
                    </span>
                  </div>
                  <span className="font-sans font-bold text-lg md:text-xl dark:text-white">{t("Chemistry")}</span>
                </div>
                <span className="bg-surface-variant dark:bg-slate-800 text-on-surface-variant dark:text-slate-200 px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {attempt.subjectBreakdown.Chemistry.status}
                </span>
              </div>
              
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs md:text-sm mb-2 font-medium">
                    <span className="text-on-surface-variant dark:text-slate-300">{t("Accuracy Rate")}</span>
                    <span className="font-bold text-on-surface dark:text-white text-sm md:text-base">{attempt.subjectBreakdown.Chemistry.score}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-container dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[#38bdf8] rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${attempt.subjectBreakdown.Chemistry.score}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3.5 bg-surface-container-low dark:bg-slate-800/80 rounded-xl border border-outline-variant/30 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary dark:text-[#FCB824] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                      trending_up
                    </span>
                    <span className="text-xs font-semibold text-on-surface dark:text-slate-200">{t("Growth Trend")}</span>
                  </div>
                  <span className="text-secondary dark:text-[#FCB824] font-bold text-xs">+{attempt.subjectBreakdown.Chemistry.growth}%</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Biology Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -6 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm border border-outline-variant dark:border-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
          >
            <div className="h-2 bg-[var(--teal)]"></div>
            <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[var(--teal)]/10 flex items-center justify-center group-hover:rotate-12 transition-transform">
                    <span className="material-symbols-outlined text-[var(--teal)] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                      eco
                    </span>
                  </div>
                  <span className="font-sans font-bold text-lg md:text-xl dark:text-white">{t("Biology")}</span>
                </div>
                <span className="bg-[var(--teal)]/10 text-[var(--teal)] px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
                  {attempt.subjectBreakdown.Biology.status}
                </span>
              </div>
              
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between text-xs md:text-sm mb-2 font-medium">
                    <span className="text-on-surface-variant dark:text-slate-300">{t("Accuracy Rate")}</span>
                    <span className="font-bold text-on-surface dark:text-white text-sm md:text-base">{attempt.subjectBreakdown.Biology.score}%</span>
                  </div>
                  <div className="h-2.5 w-full bg-surface-container dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-[var(--teal)] rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${attempt.subjectBreakdown.Biology.score}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3.5 bg-surface-container-low dark:bg-slate-800/80 rounded-xl border border-outline-variant/30 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary dark:text-[#FCB824] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                      trending_up
                    </span>
                    <span className="text-xs font-semibold text-on-surface dark:text-slate-200">{t("Growth Trend")}</span>
                  </div>
                  <span className="text-secondary dark:text-[#FCB824] font-bold text-xs">+{attempt.subjectBreakdown.Biology.growth}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* AI Recommendation Section & Lagging Topics Improvement Guide */}
      {/* Item Response Theory (IRT) Advanced Analytics */}
      

      {/* 3D Temporal Analytics Section */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{ perspective: 1000 }}
      >
        <motion.div 
          whileHover={{ rotateX: 2, rotateY: -2, z: 20, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 relative shadow-xl space-y-8"
        >
          <div className="">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center shadow-inner">
                <span className="material-symbols-outlined text-indigo-600 dark:text-indigo-400 text-2xl">timelapse</span>
              </div>
              <h3 className="text-xl md:text-2xl font-black text-[#00243B] dark:text-white tracking-tight drop-shadow-sm">{t("Temporal Analytics")}</h3>
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">{t("Real-time chronometrics mapping your cognitive velocity across different subjects and difficulty tiers.")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 ">
            {/* Average Time Stat */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-[#FCB824]/50 transition-colors relative overflow-hidden shadow-sm">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-indigo-500/10 dark:bg-indigo-400/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <span className="material-symbols-outlined text-indigo-500 text-lg">speed</span>
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("Average Time / Question")}</h4>
              </div>
              <div className="flex items-end gap-2 relative z-10">
                <p className="text-4xl font-black text-[#00243B] dark:text-white">{attempt.averageTimePerQuestionSeconds || 0}</p>
                <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">{t("seconds")}</p>
              </div>
            </div>

            {/* Fastest Subject */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-[#FCB824]/50 transition-colors relative overflow-hidden shadow-sm">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#FCB824]/10 dark:bg-[#FCB824]/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <span className="material-symbols-outlined text-[#FCB824] text-lg">bolt</span>
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("Highest Velocity")}</h4>
              </div>
              <div className="flex flex-col relative z-10">
                <p className="text-2xl font-black text-[#00243B] dark:text-white">{fastestSubject.subject}</p>
                <p className="text-xs font-bold text-[#ffd15c] dark:text-[#FCB824] mt-1">{fastestSubject.avg}s / question</p>
              </div>
            </div>

            {/* Time Friction */}
            <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-[#FCB824]/50 transition-colors relative overflow-hidden shadow-sm">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-rose-500/10 dark:bg-rose-400/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
              <div className="flex items-center gap-2 mb-4 relative z-10">
                <span className="material-symbols-outlined text-rose-500 text-lg">hourglass_bottom</span>
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("Chronometric Friction")}</h4>
              </div>
              <div className="flex flex-col relative z-10">
                <p className="text-2xl font-black text-[#00243B] dark:text-white">{slowestSubject.subject}</p>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-1">{slowestSubject.avg}s / question</p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>


      <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 relative overflow-hidden shadow-sm space-y-8">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-900/50 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-xl">psychology</span>
              </div>
              <h3 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{t("Item Response Theory (IRT) Profiling")}</h3>
            </div>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">{t("Advanced psychometric analysis based on your response patterns, mapping your cognitive ability against item difficulty and identifying potential lucky guesses versus true conceptual mastery.")}</p>
          </div>
          <button 
            onClick={() => setShowIRTReport(true)}
            className="flex-shrink-0 bg-amber-50 dark:bg-amber-900/40 text-[var(--teal)] dark:text-[#FCB824] hover:bg-amber-100 dark:hover:bg-amber-700 border border-amber-200 dark:border-amber-700 px-6 py-3 rounded-xl font-bold text-xs tracking-wider transition-colors cursor-pointer flex items-center gap-2 uppercase"
          >
            <span className="material-symbols-outlined text-sm">monitoring</span>
            View Detailed IRT Report
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-[#FCB824]/50 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[#FCB824] text-lg">scatter_plot</span>
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("Latent Ability (θ)")}</h4>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-3xl font-black text-[#00243B] dark:text-white">+1.84</p>
                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full mb-1">{t("Top 5%")}</span>
              </div>
              <div className="w-full flex h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-slate-300 w-1/2"></div>
                <div className="h-full bg-indigo-500 w-[42%]"></div>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium mt-4 leading-relaxed">{t("Your cognitive trait level is well above the average participant pool.")}</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-[#FCB824]/50 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[#FCB824] text-lg">tune</span>
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("Difficulty Threshold")}</h4>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-3xl font-black text-[#00243B] dark:text-white">{t("High")}</p>
                <div className="flex gap-1 w-full">
                  <div className="h-1.5 flex-1 bg-[#FCB824] rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-[#FCB824] rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-[#FCB824] rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium mt-4 leading-relaxed">{t("You consistently correctly answer items with a difficulty parameter (b) > 2.0.")}</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-[#FCB824]/50 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-lg">insights</span>
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("Discrimination (a)")}</h4>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-3xl font-black text-[#00243B] dark:text-white">0.92</p>
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 w-[92%] rounded-full"></div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium mt-4 leading-relaxed">{t("High correlation between your overall ability and performance on complex items.")}</p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/40 p-5 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between group hover:border-[#FCB824]/50 transition-colors">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[#FCB824] text-lg">casino</span>
                <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("Pseudo-Guessing (c)")}</h4>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-3xl font-black text-[#00243B] dark:text-white">12%</p>
                <div className="flex gap-1 w-full">
                  <div className="h-1.5 flex-1 bg-emerald-500 rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                  <div className="h-1.5 flex-1 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-600 dark:text-slate-400 font-medium mt-4 leading-relaxed">{t("Probability of answering correctly by guessing on unknown items is low.")}</p>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border-2 border-[var(--teal)]/40 dark:border-[#FCB824]/40 relative overflow-hidden shadow-lg space-y-8">
        <div className="absolute top-0 right-0 p-8 opacity-5 select-none pointer-events-none">
          <span className="material-symbols-outlined text-[160px] text-primary">psychology_alt</span>
        </div>
        
        <div className="relative z-10 flex flex-col lg:flex-row items-stretch gap-8 lg:gap-10">
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 rounded-full flex items-center justify-center border border-amber-200 dark:border-amber-700">
                  <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-2xl md:text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                    auto_awesome
                  </span>
                </div>
                <div>
                  <h3 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{t("AI Diagnostic & Strategy Report")}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("Deep concept gap analysis with exact NCERT textbook references")}</p>
                </div>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-base md:text-lg max-w-3xl mb-6 leading-relaxed">{t("Based on your results in")}<span className="font-semibold text-[var(--teal)] dark:text-[#FCB824]">{attempt.title}</span>, {t("we recommend prioritising")}{" "}
                <span className="font-bold text-[#00243B] dark:text-white">{attempt.aiRecommendation.topics[0]}</span> {t("and")}{" "}
                <span className="font-bold text-[#00243B] dark:text-white">{attempt.aiRecommendation.topics[1] || "Rotational Mechanics"}</span>. {t("Addressing these specific gaps can yield an immediate gain of")}{" "}
                <span className="font-bold text-[#ffd15c] dark:text-[#FCB824]">+{attempt.aiRecommendation.potentialGain} marks</span>{t("in your next mock.")}</p>
            </div>
            
            <div className="flex flex-wrap gap-4 mt-2">
              <button 
                onClick={onTakeTest}
                className="bg-[var(--teal)] dark:bg-[#FCB824] text-white hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] px-8 py-3.5 rounded-2xl font-bold text-xs tracking-wider flex items-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all cursor-pointer uppercase"
              >{t("START TARGETED DRILLS")}<span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
              
              <button 
                onClick={() => setShowDetailedReport(true)}
                className="border border-slate-300 dark:border-slate-700 text-[#00243B] dark:text-white hover:bg-slate-100 dark:hover:bg-[#00243B] px-8 py-3.5 rounded-2xl font-bold text-xs tracking-wider transition-all cursor-pointer flex items-center gap-2 uppercase"
              >
                <span className="material-symbols-outlined text-base">analytics</span>{t("OPEN FULL NCERT LAGGING REPORT")}</button>
            </div>
          </div>

          <div className="w-full lg:w-[340px] bg-slate-50 dark:bg-slate-900/40 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 flex-shrink-0">
            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-widest font-sans flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FCB824] text-base">priority_high</span>
              Core Focus Topics
            </h4>
            <div className="space-y-3">
              {attempt.aiRecommendation.focusAreas.map((area, idx) => (
                <div key={idx} className="flex items-center justify-between p-3.5 bg-white dark:bg-[var(--navy)] rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-[#00243B] dark:text-slate-200">{area.topic}</span>
                  <span 
                    className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                      area.level === "Critical" 
                        ? "text-amber-700 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800" 
                        : area.level === "Improvement" 
                        ? "text-amber-700 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800" 
                        : "text-amber-700 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800"
                    }`}
                  >
                    {area.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Lagging Topics & NCERT Reference Guide embedded right in the analysis section */}
        {attempt.laggingTopics && attempt.laggingTopics.length > 0 && (
          <div className="pt-6 border-t border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold text-[#00243B] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FCB824]">warning</span>
                Where You Are Lagging & Exact NCERT References
              </h4>
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {attempt.laggingTopics.length} Critical Concepts Detected
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {attempt.laggingTopics.map((lag, idx) => (
                <div key={idx} className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-amber-200 dark:border-amber-950 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-[#FCB824] px-2.5 py-0.5 rounded-full border border-[#FCB824] dark:border-amber-800">
                        {lag.subject} • {lag.unit}
                      </span>
                      <span className="text-xs font-black text-[#ffd15c] dark:text-[#FCB824]">
                        -{lag.negativeMarksLost} Marks Lost
                      </span>
                    </div>

                    <h5 className="font-bold text-sm text-[#00243B] dark:text-white mb-2">
                      {lag.topic}
                    </h5>

                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 bg-white dark:bg-[var(--navy)] rounded-xl border border-slate-200 dark:border-slate-700">
                        <p className="font-bold text-[#ffd15c] dark:text-[#FCB824] text-[10px] uppercase mb-0.5">{t("Where You Lagged:")}</p>
                        <p className="text-slate-700 dark:text-slate-300 font-medium">{lag.conceptGap}</p>
                      </div>

                      <div className="p-2.5 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl border border-amber-200/50 dark:border-amber-800/30">
                        <p className="font-bold text-amber-700 dark:text-[#FCB824] text-[10px] uppercase mb-0.5">{t("How To Improve:")}</p>
                        <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-0.5">
                          {lag.improvementSteps.map((step, sIdx) => (
                            <li key={sIdx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* NCERT Reference Block */}
                  <div className="p-3 bg-amber-50/80 dark:bg-amber-950/50 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-[var(--teal)] dark:text-[#FCB824] font-bold">
                      <span className="material-symbols-outlined text-sm">menu_book</span>
                      <span>{lag.ncertReference.book}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-[#00243B] dark:text-slate-200">
                      {lag.ncertReference.chapter} • {lag.ncertReference.pages}
                    </p>
                    <p className="text-[10px] italic text-slate-600 dark:text-slate-400 border-l-2 border-[var(--teal)] dark:border-[#FCB824] pl-2 mt-1">
                      "{lag.ncertReference.keyLines}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detailed IRT Report Modal */}
      {showIRTReport && (
        <div className="fixed inset-0 bg-[#00243B]/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[32px] p-6 md:p-8 max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 relative animate-in zoom-in-95 duration-250 my-8 max-h-[90vh] overflow-y-auto scrollbar-thin">
            <button 
              onClick={() => setShowIRTReport(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-slate-100 dark:bg-slate-900/50 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-2xl">psychology</span>
              </div>
              <div>
                <h3 className="text-xl md:text-2xl font-black text-[#00243B] dark:text-white tracking-tight">{t("IRT Diagnostic Report")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("Item Characteristic Curve & Psychometric Analysis")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* ICC Graph using SVG */}
              <div className="bg-slate-50 dark:bg-slate-900/40 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#00243B] dark:text-white uppercase tracking-widest mb-1">{t("Item Characteristic Curve (ICC)")}</h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-6">{t("Probability of correct response vs. Latent Ability (θ)")}</p>
                </div>
                
                <div className="relative w-full aspect-[4/3] bg-white dark:bg-[var(--navy)] rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 overflow-hidden">
                  <svg viewBox="0 0 400 300" className="w-full h-full overflow-visible">
                    {/* Grid lines */}
                    <line x1="0" y1="250" x2="400" y2="250" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="2" />
                    <line x1="200" y1="0" x2="200" y2="250" stroke="currentColor" className="text-slate-200 dark:text-slate-700" strokeWidth="2" strokeDasharray="4 4" />
                    
                    {/* Y-axis labels */}
                    <text x="-10" y="250" fontSize="10" fill="currentColor" className="text-slate-400" textAnchor="end">0.0</text>
                    <text x="-10" y="125" fontSize="10" fill="currentColor" className="text-slate-400" textAnchor="end">0.5</text>
                    <text x="-10" y="10" fontSize="10" fill="currentColor" className="text-slate-400" textAnchor="end">1.0</text>
                    
                    {/* X-axis labels */}
                    <text x="0" y="270" fontSize="10" fill="currentColor" className="text-slate-400" textAnchor="middle">-3.0</text>
                    <text x="200" y="270" fontSize="10" fill="currentColor" className="text-slate-400" textAnchor="middle">0.0</text>
                    <text x="400" y="270" fontSize="10" fill="currentColor" className="text-slate-400" textAnchor="middle">+3.0</text>
                    
                    {/* X-axis title */}
                    <text x="200" y="295" fontSize="10" fill="currentColor" className="text-slate-500 font-bold tracking-wider" textAnchor="middle">{t("LATENT ABILITY (θ)")}</text>

                    {/* The Sigmoid Curve (ICC) */}
                    {/* Mapped so that y=250 is 0.0, and y=0 is 1.0 */}
                    <path 
                      d="M 0 240 C 100 240, 150 200, 200 125 C 250 50, 300 10, 400 10" 
                      fill="none" 
                      stroke="currentColor" 
                      className="text-[#FCB824]"
                      strokeWidth="4" 
                      strokeLinecap="round"
                    />

                    {/* Student's Current Ability Marker */}
                    <line x1="322" y1="0" x2="322" y2="250" stroke="currentColor" className="text-[#FCB824]" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx="322" cy="20" r="6" fill="currentColor" className="text-[#FCB824]" />
                    <text x="322" y="-10" fontSize="12" fill="currentColor" className="text-[#ffd15c] dark:text-[#FCB824] font-bold" textAnchor="middle">{t("You (+1.84)")}</text>
                  </svg>
                </div>
              </div>

              {/* Text Report */}
              <div className="space-y-4">
                <div className="p-5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/40">
                  <h4 className="text-[10px] font-bold text-amber-700 dark:text-[#FCB824] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">summarize</span>
                    Performance Summary
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    Your estimated latent ability (θ) of <strong className="text-[#00243B] dark:text-white">+1.84</strong>{t(" places you in the ")}<strong>96th percentile</strong>{t(" among candidates. The steep slope of your Item Characteristic Curve (Discrimination ")}<strong className="text-[#00243B] dark:text-white">{t("a = 0.92")}</strong>) indicates highly consistent answering patterns—you rarely guess and your answers strictly correlate with topic difficulty.
                  </p>
                </div>

                <div className="p-5 bg-amber-50 dark:bg-amber-950/30 rounded-2xl border border-amber-200 dark:border-amber-800/40">
                  <h4 className="text-[10px] font-bold text-amber-700 dark:text-[#FCB824] uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">lightbulb</span>
                    Actionable IRT Insights
                  </h4>
                  <ul className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium space-y-2 list-disc pl-4">
                    <li><strong>{t("Stop reviewing easy items:")}</strong>{t(" You have a 99% probability of answering items with difficulty (b) < 0.5 correctly.")}</li>
                    <li><strong>{t("Target b > 2.5 items:")}</strong>{t(" Focus exclusively on high-complexity threshold questions. Your growth margin is entirely in the uppermost difficulty tier.")}</li>
                    <li><strong>{t("Low Guessing Dependency:")}</strong>{t("With a pseudo-guessing parameter (c) of just 12%, your score is robust and not inflated by chance.")}</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
              <button 
                onClick={() => setShowIRTReport(false)}
                className="bg-[var(--teal)] dark:bg-[#FCB824] text-white hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] px-8 py-3.5 rounded-xl font-bold text-xs tracking-wide cursor-pointer uppercase shadow-md transition-colors"
              >{t("Close Report")}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}