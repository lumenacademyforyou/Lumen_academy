import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import LumenLogo from "../components/ui/LumenLogo";
import { TestAttempt } from "../types";

interface EvaluatingViewProps {
  onEvaluationComplete: () => void;
  attempt?: TestAttempt;
}

// P2-13 (docs/assessment-tool-fix-prompt.md): this screen used to run a
// random-increment progress simulation with NO relation to any real work —
// by the time EvaluatingView mounts, App.tsx's handleSessionComplete has
// already received the real, server-scored Scorecard (submitAttempt
// finished before this component ever renders); nothing is actually being
// "evaluated" here. That random simulation could take anywhere from ~2s to
// ~7s+ depending on Math.random() luck, then bolted on a flat extra 2s no
// matter what — exactly the "blocking on computation with no fixed end"
// complaint. Replaced with a fixed, deterministic ANIMATION_MS duration
// (elapsed-time-based, not random-increment-based) capped at the item's own
// 2s ceiling, transitioning immediately once it completes — never longer,
// never shorter, never looping.
const ANIMATION_MS = 1500;

export default function EvaluatingView({ onEvaluationComplete, attempt }: EvaluatingViewProps) {
  const { t, language } = useLanguage();
  const [progress, setProgress] = useState(0);

  const phases = [
    { atFraction: 0, status: t("Evaluating your test..."), sub: t("Analyzing accuracy metrics") },
    { atFraction: 0.4, status: t("Generating deep insights..."), sub: attempt ? attempt.title : t("Preparing your report") },
    { atFraction: 0.75, status: t("Almost there..."), sub: t("Preparing your scorecard") },
    { atFraction: 1, status: t("Analysis Complete!"), sub: t("Redirecting to your scorecard") },
  ];
  const phaseIndex = phases.reduce((acc, p, idx) => (progress / 100 >= p.atFraction ? idx : acc), 0);

  useEffect(() => {
    const startedAt = performance.now();
    let frameId: number;

    const tick = () => {
      const elapsed = performance.now() - startedAt;
      const nextProgress = Math.min(100, (elapsed / ANIMATION_MS) * 100);
      setProgress(nextProgress);

      if (elapsed >= ANIMATION_MS) {
        onEvaluationComplete();
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownloadSummary = () => {
    if (!attempt) return;
    
    // Phase G cleanup: dropped percentile (assess.scorecard.percentile is
    // never populated anywhere server-side — always a stale, frozen
    // carried-forward number, never real), subjectBreakdown (merges
    // Botany+Zoology into a fake "Biology" bucket and its `status` field is
    // never computed from real data), and aiRecommendation.topics (always
    // empty on a real attempt — see buildHonestAttemptFromScorecard in
    // App.tsx). Only fields the server actually returns remain.
    const summaryText = `
LUMEN ACADEMY - TEST PERFORMANCE SUMMARY
----------------------------------------
Test: ${attempt.title}
Date: ${attempt.date}
Score: ${attempt.totalScore}
Accuracy: ${attempt.accuracy}%

-- PERFORMANCE DETAILS --
Correct Answers: ${attempt.correctAnswers}
Incorrect Answers: ${attempt.incorrectAnswers}
Skipped Answers: ${attempt.skippedAnswers}
Time Taken: ${attempt.timeTakenMinutes} minutes
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
