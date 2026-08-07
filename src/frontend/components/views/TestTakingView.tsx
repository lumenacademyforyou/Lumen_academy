import React, { useState, useEffect, useRef, useMemo } from "react";
import { Question } from "../../../types";
import { BIOLOGY_QUESTIONS } from "../../../database/questions";
import LumenLogo from "../common/LumenLogo";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../contexts/LanguageContext";

interface TestTakingViewProps {
  onCompleteTest: (answers: { [key: number]: number }, flagged: number[], timeMap: Record<number, number>) => void;
  onCancel: () => void;
  studentName: string;
  customQuestions?: Question[];
  customDurationSeconds?: number;
  customTitle?: string;
  customMode?: "standard" | "practice";
}

export default function TestTakingView({ 
  onCompleteTest, 
  onCancel, 
  studentName,
  customQuestions,
  customDurationSeconds,
  customTitle,
  customMode = "standard"
}: TestTakingViewProps) {
  const { t, language, toggleLanguage, setLanguage } = useLanguage();

  // Reset language to English when leaving the test
  useEffect(() => {
    return () => {
      setLanguage('en');
    };
  }, [setLanguage]);

  const questions = customQuestions || BIOLOGY_QUESTIONS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeSubjectFilter, setActiveSubjectFilter] = useState<string>("All Subjects");

  const subjectsData = useMemo(() => {
    const counts = questions.reduce((acc, q) => {
      acc[q.subject] = (acc[q.subject] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return [
      { name: "All Subjects", count: questions.length },
      ...Object.entries(counts).map(([name, count]) => ({ name, count }))
    ];
  }, [questions]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<number[]>([]); // list of question IDs
  const [visitedQuestions, setVisitedQuestions] = useState<number[]>(() => [questions[0].id]);
  const [questionTimeMap, setQuestionTimeMap] = useState<Record<number, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(customDurationSeconds || 300); // custom timer in seconds
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    setVisitedQuestions((prev) => {
      const currentId = questions[currentIndex].id;
      if (!prev.includes(currentId)) {
        return [...prev, currentId];
      }
      return prev;
    });
  }, [currentIndex, questions]);

  // Countdown timer for active test
  useEffect(() => {
    if (timeRemaining <= 0) {
      // Auto-submit on timeout
      handleSubmitAnyway();
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
      setQuestionTimeMap((prev) => ({
        ...prev,
        [questions[currentIndex].id]: (prev[questions[currentIndex].id] || 0) + 1
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, currentIndex]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSelectOption = (optionIndex: number) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questions[currentIndex].id]: optionIndex,
    }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleToggleFlag = () => {
    const currentId = questions[currentIndex].id;
    if (flaggedQuestions.includes(currentId)) {
      setFlaggedQuestions((prev) => prev.filter((id) => id !== currentId));
    } else {
      setFlaggedQuestions((prev) => [...prev, currentId]);
    }
  };

  const handleClear = () => {
    const currentId = questions[currentIndex].id;
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentId];
      return copy;
    });
  };

  // Prepare submission
  const handleTriggerSubmit = () => {
    setShowSubmitModal(true);
  };

  const handleSubmitAnyway = () => {
    setShowSubmitModal(false);
    onCompleteTest(selectedAnswers, flaggedQuestions, questionTimeMap);
  };

  // Calculate dynamic statistics
  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = questions.length - answeredCount;
  const attemptedPercentage = Math.round((answeredCount / (questions.length || 1)) * 100);

  const totalDuration = customDurationSeconds || 300;
  const timeProgress = ((totalDuration - timeRemaining) / totalDuration) * 100;
  const isTimeRunningLow = timeRemaining < totalDuration * 0.2;
  const isUnder10Mins = timeRemaining <= 600 && timeRemaining > 0;

  return (
    <div className="min-h-screen bg-[#f8f9ff] dark:bg-[#031824] flex flex-col font-sans animate-in fade-in duration-300">
      
      {/* Test taking header bar */}
      <header className="fixed top-0 left-0 right-0 h-20 bg-white dark:bg-[var(--navy)] border-b border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between px-6 md:px-12 z-40">
        {/* Persistent Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${
              isTimeRunningLow 
                ? 'bg-red-500 animate-pulse' 
                : isUnder10Mins 
                  ? 'bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.8)]' 
                  : 'bg-[var(--teal)] dark:bg-[#FCB824]'
            }`} 
            style={{ width: `${timeProgress}%` }}
          />
        </div>
        <div className="flex items-center gap-3.5">
          <div className="h-16 w-16 md:h-18 md:w-18 flex-shrink-0 transition-transform hover:scale-105 duration-200">
            <LumenLogo className="w-full h-full" />
          </div>
          <div className="hidden sm:block">
            <span className="font-black text-base md:text-lg text-[var(--navy)] dark:text-white uppercase tracking-wide block leading-none">
              LUMEN ACADEMY
            </span>
            <p className="text-xs text-[var(--teal)] dark:text-[#FCB824] font-bold mt-1">{customTitle || "NEET Biology Mini-Mock #12"}</p>
          </div>
        </div>

        {/* Attempt Progress */}
        <div className="hidden lg:flex flex-col flex-1 px-12 max-w-2xl">
          <div className="flex justify-between items-center text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5 px-1 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <span>{t("Progress")}</span>
              {isUnder10Mins && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 animate-pulse font-bold normal-case tracking-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                  {t("<10m remaining")}
                </span>
              )}
            </span>
            <span className="text-[var(--navy)] dark:text-white">{answeredCount} / {questions.length}</span>
          </div>
          <div className={`h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border transition-all ${
            isUnder10Mins ? 'border-amber-400/80 dark:border-amber-500/60 ring-2 ring-amber-400/20' : 'border-slate-200/60 dark:border-slate-700'
          }`}>
            <div 
              className={`h-full bg-[var(--teal)] dark:bg-[#FCB824] transition-all duration-500 rounded-full ${isUnder10Mins ? 'animate-pulse bg-gradient-to-r from-[var(--teal)] via-amber-400 to-[#FCB824]' : ''}`}
              style={{ width: `${attemptedPercentage}%` }}
            />
          </div>
        </div>

        {/* Live Timer Section */}
        <div className="flex items-center gap-6">
          {/* Language Switcher */}
          <div className="relative shrink-0 hidden md:block">
            <button
              onClick={toggleLanguage}
              className="px-2.5 py-1.5 h-9 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 transition-colors font-bold text-xs cursor-pointer shadow-sm"
              title="Change Language (English / Tamil)"
            >
              <span className="material-symbols-outlined text-[18px]">translate</span>
              <span className="hidden md:inline uppercase tracking-wider">{language === 'en' ? 'A / அ' : 'அ / A'}</span>
            </button>
          </div>

          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold font-mono text-sm md:text-base transition-all ${
            isTimeRunningLow 
              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40 animate-pulse'
              : isUnder10Mins 
                ? 'bg-amber-100 dark:bg-[#FCB824]/15 text-amber-800 dark:text-[#FCB824] border border-amber-400 dark:border-[#FCB824]/40 animate-pulse' 
                : 'bg-amber-100 dark:bg-[#FCB824]/10 text-amber-700 dark:text-[#FCB824] border border-amber-300 dark:border-[#FCB824]/25'
          }`}>
            <span className="material-symbols-outlined text-base animate-pulse">timer</span>
            <span>{t("TIME REMAINING")}: {formatTime(timeRemaining)}</span>
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
            <span className="text-[#00243B] dark:text-white font-semibold text-xs md:text-sm hidden md:inline">{studentName}</span>
            <div className="h-10 w-10 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
              <img 
                alt="User Profile" 
                className="w-full h-full object-cover" 
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuC14bMZwlf-l7FkDtIuh6mlDcukjiiukaCDp9R7e_txfTfhT-BKWgAJRF3mmeERK6ZqYGYff_GDST6tgblpcidKkCqiKK2bX9veFQs46EOMtQw0Agppc78WjZOcA0FJTMpmgewqb1IuX96Pb1hDpQE1q1z5F8b3qgml2RtFlEmxidxmG9S2NTrWEVmR7HHnPSnEK2Vx0vo6Mf_j0vQKx7wKjZ9yBlMDYLEJRm1Cy9m_HUvF0O4ZMSuA"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content splits into Question Area and Palette Sidebar */}
      <main className="flex-1 pt-28 pb-24 px-6 md:px-12 flex flex-col lg:flex-row gap-8 max-w-[1280px] mx-auto w-full">
        
        {/* Left: Active Question Panel */}
        <div className="flex-1 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-3xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm flex flex-col justify-between min-h-[480px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
                <span className="text-xs font-bold text-[var(--teal)] dark:text-[#FCB824] uppercase tracking-wider">
                  Question {currentIndex + 1} of {questions.length}
                </span>
              <span className="bg-[var(--teal)]/10 dark:bg-[#FCB824]/20 text-[var(--teal)] dark:text-amber-200 px-3.5 py-1 rounded-full text-xs font-semibold uppercase">
                {questions[currentIndex].subject}
              </span>
            </div>

            {/* Question Text */}
            <h2 className="text-base md:text-lg font-bold text-[#00243B] dark:text-white mb-6 leading-relaxed font-sans">
              <div className="mb-2">{questions[currentIndex].text}</div>
              {language === 'ta' && questions[currentIndex].textTa && (
                <div className="text-[var(--teal)] dark:text-[#FCB824]">{questions[currentIndex].textTa}</div>
              )}
            </h2>

            {/* Options List */}
            <div className="space-y-4">
              {questions[currentIndex].options.map((option, idx) => {
                const isSelected = selectedAnswers[questions[currentIndex].id] === idx;
                const optionTa = questions[currentIndex].optionsTa?.[idx];
                return (
                  <button
                    key={idx}
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full text-left p-4.5 rounded-2xl border text-sm md:text-base font-semibold transition-all flex items-center gap-4 cursor-pointer ${
                      isSelected
                        ? "bg-amber-100/70 dark:bg-amber-900/40 border-[#FCB824] dark:border-[#FCB824] text-[#00243B] dark:text-white shadow-sm ring-2 ring-[#FCB824]/40"
                        : "border-slate-200 dark:border-slate-700 text-[#00243B] dark:text-slate-200 bg-white dark:bg-[#071d2b] hover:bg-slate-50 dark:hover:bg-[#0e3043]"
                    }`}
                  >
                    <div 
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected 
                          ? "border-[#FCB824] bg-[#FCB824] text-[#00243B]" 
                          : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}
                    </div>
                    <div className="flex flex-col gap-1">
                      <span>{option}</span>
                      {language === 'ta' && optionTa && (
                        <span className="text-[var(--teal)] dark:text-[#FCB824] opacity-90 text-sm">{optionTa}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {customMode === "practice" && (
              <div className="mt-6 p-5 bg-yellow-50/50 border border-yellow-200/60 rounded-2xl animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-yellow-800 mb-1.5">
                  <span className="material-symbols-outlined text-lg">emoji_objects</span>
                  <span className="text-xs font-bold uppercase tracking-wider">{t("Practice Mode Assistance")}</span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                  <strong>{t("Correct Option:")}</strong> Option {String.fromCharCode(65 + questions[currentIndex].correctAnswerIndex)}
                </p>
                {questions[currentIndex].explanation && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold italic">
                    {questions[currentIndex].explanation}
                  </p>
                )}
              </div>
            )}
            </motion.div>
          </AnimatePresence>

          {/* Nav Footer Actions */}
          <div className="flex flex-wrap justify-between items-center gap-4 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-2">
              <button
                onClick={handleToggleFlag}
                className={`px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  flaggedQuestions.includes(questions[currentIndex].id)
                    ? "bg-[#FCB824] text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span className="material-symbols-outlined text-sm">flag</span>
                {flaggedQuestions.includes(questions[currentIndex].id) ? "Flagged for Review" : "Flag for Review"}
              </button>
              
              <button
                onClick={handleClear}
                disabled={selectedAnswers[questions[currentIndex].id] === undefined}
                className="px-5 py-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#ffd15c] dark:hover:text-[#FCB824] hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              >{t("Clear Response")}</button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 px-5 py-3 rounded-xl text-xs font-bold disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              >
                Previous
              </button>
              
              <button
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1}
                className="bg-[var(--teal)] dark:bg-[#FCB824] text-white hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] px-5 py-3 rounded-xl text-xs font-bold disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              >
                Save & Next
              </button>
            </div>
          </div>
        </div>

        {/* Right: Status Palette Sidebar */}
        <div className="w-full lg:w-[320px] bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-3xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm flex flex-col justify-between gap-6">
          <div>
            {/* Subject Tabs */}
            <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
              {subjectsData.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setActiveSubjectFilter(s.name)}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${activeSubjectFilter === s.name ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}
                >
                  {s.name} ({s.count})
                </button>
              ))}
            </div>

            <h3 className="font-bold text-sm text-[#00243B] dark:text-white mb-1 uppercase tracking-wide">{t("Question Palette")}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">{t("Review answered, flagged, and skipped questions")}</p>

            {/* Interactive Grid of Questions */}
            <div className="grid grid-cols-5 gap-3.5">
              {questions.map((q, idx) => {
                if (activeSubjectFilter !== "All Subjects" && q.subject !== activeSubjectFilter) return null;
                const isCurrent = idx === currentIndex;
                const isAnswered = selectedAnswers[q.id] !== undefined;
                const isFlagged = flaggedQuestions.includes(q.id);
                const isVisited = visitedQuestions.includes(q.id);

                let bgClass = "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"; // not visited
                let hasDot = false;

                if (isFlagged && isAnswered) {
                  bgClass = "bg-violet-600 dark:bg-violet-500 text-white";
                  hasDot = true;
                } else if (isFlagged && !isAnswered) {
                  bgClass = "bg-violet-600 dark:bg-violet-500 text-white";
                } else if (isAnswered) {
                  bgClass = "bg-green-600 dark:bg-green-600 text-white";
                } else if (isVisited && !isAnswered) {
                  bgClass = "bg-red-500 dark:bg-red-500 text-white";
                }

                let borderClass = isCurrent ? "ring-2 ring-sky-400 dark:ring-sky-300 ring-offset-1 dark:ring-offset-[var(--navy)] scale-110 z-10" : "border border-transparent";

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-11 rounded-xl font-bold text-xs transition-all relative flex items-center justify-center cursor-pointer hover:scale-105 ${bgClass} ${borderClass}`}
                  >
                    {idx + 1}
                    {hasDot && (
                      <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-400 shadow-sm border border-violet-900"></span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Color Guide Legends */}
            <div className="grid grid-cols-1 gap-2.5 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-md bg-green-600 dark:bg-green-600 inline-block flex-shrink-0"></span>
                <span>{t("Answered")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-md bg-red-500 inline-block flex-shrink-0"></span>
                <span>{t("Not Answered")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-md bg-slate-200 dark:bg-slate-700 inline-block flex-shrink-0"></span>
                <span>{t("Not Visited")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="w-4 h-4 rounded-md bg-violet-600 dark:bg-violet-500 inline-block flex-shrink-0"></span>
                <span>{t("Flag for review")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-4 h-4 rounded-md bg-violet-600 dark:bg-violet-500 relative inline-block flex-shrink-0">
                  <span className="absolute bottom-[-1px] right-[-1px] w-1.5 h-1.5 rounded-full bg-green-400 border border-violet-900"></span>
                </div>
                <span>{t("Flag for review and answered")}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <button
              onClick={handleTriggerSubmit}
              className="w-full py-4 bg-[#ffd15c] hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wide rounded-2xl shadow-md transition-all cursor-pointer"
            >{t("Submit Test?")}</button>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to exit the test? Your current progress will be lost.")) {
                  onCancel();
                }
              }}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wide rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-center block"
            >
              Exit Lobby
            </button>
          </div>
        </div>
      </main>

      {/* Footer copyright */}
      <footer className="h-16 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-[#031824] mt-auto">
        <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold bg-slate-200 dark:bg-slate-800/80 px-4 py-1.5 rounded-md">
          © 2026 Lumen Academy. All rights reserved.
        </p>
      </footer>

      {/* Submit Warning Overlay Dialog matching Screen 3 precisely */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#00243B]/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white w-full max-w-lg rounded-[36px] md:rounded-[48px] p-8 md:p-12 shadow-2xl flex flex-col items-center text-center border border-slate-200 dark:border-slate-700">
            
            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-6 md:mb-8 animate-bounce ${unansweredCount > 0 ? "bg-red-100 dark:bg-red-950/60" : "bg-emerald-100 dark:bg-emerald-950/60"}`}>
              <span className={`material-symbols-outlined text-[40px] md:text-[48px] ${unansweredCount > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-500 dark:text-emerald-400"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {unansweredCount > 0 ? "warning" : "check_circle"}
              </span>
            </div>

            <h2 className="font-sans font-extrabold text-3xl md:text-4xl text-[#00243B] dark:text-white mb-2">
              {t("Submit Test?")}
            </h2>
            
            <div className="text-slate-600 dark:text-slate-300 text-sm md:text-base mb-8 md:mb-10 leading-relaxed font-sans font-medium space-y-3">
              {unansweredCount > 0 ? (
                <p>
                  {language === 'en' ? (
                    <>You have <span className="font-extrabold text-red-500 dark:text-red-400">{unansweredCount} unanswered questions</span> remaining. If you submit now, these will be marked as skipped.</>
                  ) : (
                    <>உங்களிடம் <span className="font-extrabold text-red-500 dark:text-red-400">{unansweredCount} பதிலளிக்கப்படாத கேள்விகள்</span> உள்ளன. இப்போது சமர்ப்பித்தால், இவை தவிர்க்கப்பட்டதாகக் கருதப்படும்.</>
                  )}
                </p>
              ) : (
                <p>
                  {language === 'en' ? (
                    <>You have <span className="font-extrabold text-emerald-500 dark:text-emerald-400">answered all questions</span>. Are you sure you want to submit the test?</>
                  ) : (
                    <>நீங்கள் <span className="font-extrabold text-emerald-500 dark:text-emerald-400">அனைத்து கேள்விகளுக்கும் பதிலளித்துவிட்டீர்கள்</span>. தேர்வை சமர்ப்பிக்க வேண்டுமா?</>
                  )}
                </p>
              )}
            </div>

            <div className="w-full space-y-3">
              <button 
                onClick={handleSubmitAnyway}
                className={`w-full py-4 text-white font-bold text-base md:text-lg rounded-2xl shadow-lg transition-all cursor-pointer ${
                  unansweredCount > 0 
                    ? "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700" 
                    : "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                }`}
              >
                {unansweredCount > 0 ? t("Submit Anyway") : t("Submit Test")}
              </button>
              
              <button 
                onClick={() => setShowSubmitModal(false)}
                className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-[#00243B] dark:text-white border border-slate-300 dark:border-slate-700 font-bold text-base md:text-lg rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                {t("Go Back & Review")}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
