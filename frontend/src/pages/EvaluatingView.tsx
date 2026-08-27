import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import LumenLogo from "../components/ui/LumenLogo";
import { TestAttempt } from "../types";

interface EvaluatingViewProps {
  onEvaluationComplete: () => void;
  attempt?: TestAttempt;
}

export default function EvaluatingView({ onEvaluationComplete, attempt }: EvaluatingViewProps) {
  const { t, language } = useLanguage();
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  const phases = [
    { limit: 30, status: t("Evaluating your test..."), sub: t("Analyzing accuracy metrics") },
    { limit: 65, status: t("Generating deep insights..."), sub: t("Preparing report for NEET Biology Mini-Mock #12") },
    { limit: 90, status: t("Almost there..."), sub: t("Mapping progress to Biology, Chemistry & Physics") },
    { limit: 100, status: t("Analysis Complete!"), sub: t("Redirecting to your scorecard") }
  ];

  useEffect(() => {
    // Run the loading simulation from 0% to 100%
    const interval = setInterval(() => {
      setProgress((prev) => {
        const increment = Math.random() * 6 + 2;
        const nextProgress = Math.min(prev + increment, 100);

        if (nextProgress >= 100) {
          clearInterval(interval);
          // Small delay before transition to make it feel polished
          setTimeout(() => {
            onEvaluationComplete();
          }, 2000); // Increased delay slightly so user has a chance to download or read
          return 100;
        }

        // Determine current status phase
        const matchingPhaseIdx = phases.findIndex((p) => nextProgress < p.limit);
        if (matchingPhaseIdx !== -1 && matchingPhaseIdx !== phaseIndex) {
          setPhaseIndex(matchingPhaseIdx);
        }

        return nextProgress;
      });
    }, 150); // Slightly slower to give time

    return () => clearInterval(interval);
  }, [phaseIndex, onEvaluationComplete]);

  const handleDownloadSummary = () => {
    if (!attempt) return;
    
    const summaryText = `
LUMEN ACADEMY - TEST PERFORMANCE SUMMARY
----------------------------------------
Test: ${attempt.title}
Date: ${attempt.date}
Score: ${attempt.totalScore}
Accuracy: ${attempt.accuracy}%
Percentile: ${attempt.percentile}th

-- PERFORMANCE DETAILS --
Correct Answers: ${attempt.correctAnswers}
Incorrect Answers: ${attempt.incorrectAnswers}
Skipped Answers: ${attempt.skippedAnswers}
Time Taken: ${attempt.timeTakenMinutes} minutes

-- SUBJECT BREAKDOWN --
Physics: ${attempt.subjectBreakdown.Physics.score}% (${attempt.subjectBreakdown.Physics.status})
Chemistry: ${attempt.subjectBreakdown.Chemistry.score}% (${attempt.subjectBreakdown.Chemistry.status})
Biology: ${attempt.subjectBreakdown.Biology.score}% (${attempt.subjectBreakdown.Biology.status})

-- AI RECOMMENDATIONS --
${attempt.aiRecommendation.topics.map(t => `- ${t}`).join('\n')}
    `.trim();

    const blob = new Blob([summaryText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `lumen_summary_${attempt.id}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Current active status messages
  const currentPhase = phases[phaseIndex] || phases[phases.length - 1];

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[var(--navy)] flex flex-col items-center justify-center p-6 select-none overflow-hidden animate-in fade-in duration-300">
      
      {/* Background Gradient Decorative Shimmer Layer */}
      <div className="absolute inset-0 bg-slate-50 dark:bg-slate-900/40 animate-gradient-shift opacity-60 pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center max-w-2xl text-center px-6">
        
        {/* Breathing Core Logo Module */}
        <div className="relative w-40 h-40 md:w-48 md:h-48 mb-10 flex items-center justify-center">
          {/* Pulsing Orbital Rings */}
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping opacity-35"></div>
          <div className="absolute w-32 h-32 rounded-full bg-amber-500/10 border border-amber-500/20 animate-pulse-subtle"></div>
          
          {/* Shimmering Core Symbol Box */}
          <div className="relative z-10 w-28 h-28 bg-white rounded-full flex items-center justify-center shadow-2xl animate-logo-breathe border border-amber-200 dark:border-amber-900/30 overflow-hidden">
            <LumenLogo className="w-[85%] h-[85%]" />
            <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
              <div className="w-full h-full bg-white/10 animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* Phase Loading Information */}
        <div className="space-y-6">
          <h1 className="text-3xl md:text-4xl font-sans font-extrabold tracking-tight shimmer-text animate-shimmer-text">
            {currentPhase.status}
          </h1>

          {/* Interactive Shimmer Progress Bar */}
          <div className="w-72 md:w-96 h-3 bg-white dark:bg-[var(--navy)]-container-highest rounded-full overflow-hidden shadow-inner mx-auto relative border border-amber-200 dark:border-amber-900/10">
            <div 
              className="h-full bg-amber-500 rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(0,105,114,0.4)]"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <p className="text-slate-600 dark:text-slate-300 font-medium text-sm md:text-base h-6 opacity-85 transition-all">
            {currentPhase.sub}
          </p>
        </div>

        {/* Download Summary Button */}
        {attempt && (
          <div className="mt-8 opacity-0 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 fill-mode-forwards">
            <button
              onClick={handleDownloadSummary}
              className="px-6 py-2.5 bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 border border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              {t("Download Summary (.txt)")}
            </button>
          </div>
        )}

        {/* Animated Bouncing Indicator Dots */}
        <div className="mt-8 flex gap-3">
          <div className="w-3 h-3 rounded-full bg-amber-500/50 animate-bounce" style={{ animationDelay: "0.1s" }}></div>
          <div className="w-3 h-3 rounded-full bg-amber-500/50 animate-bounce" style={{ animationDelay: "0.2s" }}></div>
          <div className="w-3 h-3 rounded-full bg-amber-500/50 animate-bounce" style={{ animationDelay: "0.3s" }}></div>
        </div>

      </div>
    </div>
  );
}
