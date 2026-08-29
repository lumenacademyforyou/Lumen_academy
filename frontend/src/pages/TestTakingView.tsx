import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import LumenLogo from "../components/ui/LumenLogo";
import QuestionImage from "../components/ui/QuestionImage";
import Modal from "../components/layout/Modal";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../contexts/LanguageContext";
import type { EnvelopeQuestion, Scorecard, SessionResult } from "../types";
import { saveResponses, submitAttempt as submitAttemptApi, type ResponseUpdate } from "../services/sessionApi";

interface TestTakingViewProps {
  session: SessionResult;
  // elapsedMinutes: real (totalDuration - timeRemaining) at submit time —
  // Phase G's dashboard needs a genuine time-taken figure, not a hardcoded 0.
  onCompleteTest: (scorecard: Scorecard, elapsedMinutes: number) => void;
  onCancel: () => void;
  studentName: string;
}

// Real questions are always served in test_section_id (uuid) lexicographic
// order from the envelope (envelope.ts's query), which has no relation to a
// section's actual display sequence_no — the field C5's full-mock shuffle
// randomizes. Reorder client-side: sections in their real sequenceNo order,
// each section's own questions in their own sequenceNo order, so contiguous
// per-section navigation (D5/D7) and C5's shuffled section order both render
// correctly regardless of the envelope's raw row order.
function orderQuestions(session: SessionResult): EnvelopeQuestion[] {
  const bySection = new Map<string, EnvelopeQuestion[]>();
  for (const q of session.questions) {
    const list = bySection.get(q.testSectionId) ?? [];
    list.push(q);
    bySection.set(q.testSectionId, list);
  }
  const orderedSections = [...session.sections].sort((a, b) => a.sequenceNo - b.sequenceNo);
  return orderedSections.flatMap((s) => (bySection.get(s.testSectionId) ?? []).sort((a, b) => a.sequenceNo - b.sequenceNo));
}

const AUTOSAVE_INTERVAL_MS = 12000;

export default function TestTakingView({ session, onCompleteTest, onCancel, studentName }: TestTakingViewProps) {
  const { t, language, toggleLanguage } = useLanguage();

  const questions = useMemo(() => orderQuestions(session), [session]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>("all");

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(new Set());
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(() => new Set([questions[0]?.questionId].filter(Boolean) as string[]));
  const [questionTimeMap, setQuestionTimeMap] = useState<Record<string, number>>({});
  const [timeRemaining, setTimeRemaining] = useState(session.remainingSeconds);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const currentQuestion = questions[currentIndex];

  // --- Autosave: dirty responses flush on an interval and on nav/flag/clear.
  const dirtyRef = useRef<Set<string>>(new Set());
  const savingRef = useRef(false);
  const selectedAnswersRef = useRef(selectedAnswers);
  const flaggedRef = useRef(flaggedQuestions);
  const timeMapRef = useRef(questionTimeMap);
  selectedAnswersRef.current = selectedAnswers;
  flaggedRef.current = flaggedQuestions;
  timeMapRef.current = questionTimeMap;

  const flushDirty = useCallback(async () => {
    if (savingRef.current || dirtyRef.current.size === 0) return;
    const ids = Array.from(dirtyRef.current);
    dirtyRef.current = new Set();
    savingRef.current = true;
    const payload: ResponseUpdate[] = ids.map((qid) => ({
      questionId: qid,
      optionId: selectedAnswersRef.current[qid] ?? null,
      isMarkedForReview: flaggedRef.current.has(qid),
      timeSpentSeconds: Math.round(timeMapRef.current[qid] ?? 0),
    }));
    try {
      await saveResponses(session.attemptId, payload);
      setSaveError(null);
    } catch (err) {
      // Put the ids back so the next interval retries them — autosave must
      // never silently drop a response.
      for (const id of ids) dirtyRef.current.add(id);
      setSaveError(err instanceof Error ? err.message : "Autosave failed — will retry.");
    } finally {
      savingRef.current = false;
    }
  }, [session.attemptId]);

  useEffect(() => {
    const interval = setInterval(() => {
      flushDirty();
    }, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [flushDirty]);

  useEffect(() => {
    if (!currentQuestion) return;
    setVisitedQuestions((prev) => (prev.has(currentQuestion.questionId) ? prev : new Set(prev).add(currentQuestion.questionId)));
  }, [currentQuestion]);

  // Countdown timer — server-computed remainingSeconds at session creation is
  // the source of truth; ticked down locally from there for the same live-UX
  // the previous client-only timer had. Surviving a reload with a corrected
  // server-recomputed value is Phase E's job (session management), not this
  // one's — this session is always freshly created, never reloaded mid-test.
  useEffect(() => {
    if (timeRemaining <= 0) {
      handleSubmitAnyway();
      return;
    }
    const timer = setInterval(() => {
      setTimeRemaining((prev) => prev - 1);
      if (currentQuestion) {
        setQuestionTimeMap((prev) => ({ ...prev, [currentQuestion.questionId]: (prev[currentQuestion.questionId] || 0) + 1 }));
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining, currentQuestion]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const markDirty = (questionId: string) => {
    dirtyRef.current.add(questionId);
  };

  const handleSelectOption = (optionId: string) => {
    if (!currentQuestion) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.questionId]: optionId }));
    markDirty(currentQuestion.questionId);
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((prev) => prev + 1);
  };
  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleToggleFlag = () => {
    if (!currentQuestion) return;
    const id = currentQuestion.questionId;
    setFlaggedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    markDirty(id);
  };

  const handleClear = () => {
    if (!currentQuestion) return;
    const id = currentQuestion.questionId;
    setSelectedAnswers((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    markDirty(id);
  };

  const handleTriggerSubmit = async () => {
    await flushDirty();
    setShowSubmitModal(true);
  };

  const handleSubmitAnyway = async () => {
    setShowSubmitModal(false);
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await flushDirty();
      const scorecard = await submitAttemptApi(session.attemptId);
      const durationSeconds = session.test.durationMinutes ? session.test.durationMinutes * 60 : session.remainingSeconds || 0;
      const elapsedMinutes = Math.round(Math.max(0, durationSeconds - timeRemaining) / 60);
      onCompleteTest(scorecard, elapsedMinutes);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong submitting your test.");
      setIsSubmitting(false);
    }
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const unansweredCount = questions.length - answeredCount;
  const attemptedPercentage = Math.round((answeredCount / (questions.length || 1)) * 100);

  const totalDuration = session.test.durationMinutes ? session.test.durationMinutes * 60 : session.remainingSeconds || 300;
  const timeProgress = ((totalDuration - timeRemaining) / totalDuration) * 100;
  const isTimeRunningLow = timeRemaining < totalDuration * 0.2;
  const isUnder10Mins = timeRemaining <= 600 && timeRemaining > 0;

  const sectionsForTabs = [{ testSectionId: "all", sectionName: "All Sections" }, ...[...session.sections].sort((a, b) => a.sequenceNo - b.sequenceNo)];

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9ff] dark:bg-[#031824]">
        <p className="text-slate-500 dark:text-slate-400 font-semibold">{t("This test has no questions to display.")}</p>
      </div>
    );
  }

  const stemImage = currentQuestion.images.find((img) => img.optionId === null);

  return (
    <div className="min-h-screen bg-[#f8f9ff] dark:bg-[#031824] flex flex-col font-sans animate-in fade-in duration-300">
      <header className="fixed top-0 left-0 right-0 h-20 bg-white dark:bg-[var(--navy)] border-b border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between px-6 md:px-12 z-40">
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${
              isTimeRunningLow ? "bg-red-500 animate-pulse" : isUnder10Mins ? "bg-amber-500 animate-pulse shadow-[0_0_12px_rgba(245,158,11,0.8)]" : "bg-[var(--teal)] dark:bg-[#FCB824]"
            }`}
            style={{ width: `${timeProgress}%` }}
          />
        </div>
        <div className="flex items-center gap-3.5">
          <div className="h-16 w-16 md:h-18 md:w-18 flex-shrink-0 transition-transform hover:scale-105 duration-200">
            <LumenLogo className="w-full h-full" />
          </div>
          <div className="hidden sm:block">
            <span className="font-black text-base md:text-lg text-[var(--navy)] dark:text-white uppercase tracking-wide block leading-none">LUMEN ACADEMY</span>
            <p className="text-xs text-[var(--teal)] dark:text-[#FCB824] font-bold mt-1">{session.test.title}</p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{session.testCode}</p>
          </div>
        </div>

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
            <span className="text-[var(--navy)] dark:text-white">
              {answeredCount} / {questions.length}
            </span>
          </div>
          <div
            className={`h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner border transition-all ${
              isUnder10Mins ? "border-amber-400/80 dark:border-amber-500/60 ring-2 ring-amber-400/20" : "border-slate-200/60 dark:border-slate-700"
            }`}
          >
            <div
              className={`h-full bg-[var(--teal)] dark:bg-[#FCB824] transition-all duration-500 rounded-full ${isUnder10Mins ? "animate-pulse bg-gradient-to-r from-[var(--teal)] via-amber-400 to-[#FCB824]" : ""}`}
              style={{ width: `${attemptedPercentage}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="relative shrink-0 hidden md:block">
            <button
              onClick={toggleLanguage}
              className="px-2.5 py-1.5 h-9 flex items-center justify-center gap-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 transition-colors font-bold text-xs cursor-pointer shadow-sm"
              title="Change Language (English / Tamil)"
            >
              <span className="material-symbols-outlined text-[18px]">translate</span>
              <span className="hidden md:inline uppercase tracking-wider">{language === "en" ? "A / அ" : "அ / A"}</span>
            </button>
          </div>

          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold font-mono text-sm md:text-base transition-all ${
              isTimeRunningLow
                ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-300 dark:border-red-500/40 animate-pulse"
                : isUnder10Mins
                  ? "bg-amber-100 dark:bg-[#FCB824]/15 text-amber-800 dark:text-[#FCB824] border border-amber-400 dark:border-[#FCB824]/40 animate-pulse"
                  : "bg-amber-100 dark:bg-[#FCB824]/10 text-amber-700 dark:text-[#FCB824] border border-amber-300 dark:border-[#FCB824]/25"
            }`}
          >
            <span className="material-symbols-outlined text-base animate-pulse">timer</span>
            <span>
              {t("TIME REMAINING")}: {formatTime(timeRemaining)}
            </span>
          </div>

          <div className="flex items-center gap-3 pl-4 border-l border-slate-200 dark:border-slate-700">
            <span className="text-[#00243B] dark:text-white font-semibold text-xs md:text-sm hidden md:inline">{studentName}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-28 pb-24 px-6 md:px-12 flex flex-col lg:flex-row gap-8 max-w-[1280px] mx-auto w-full">
        <div className="flex-1 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-3xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm flex flex-col justify-between min-h-[480px]">
          <AnimatePresence mode="wait">
            <motion.div key={currentIndex} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
              <div className="flex justify-between items-center pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
                <span className="text-xs font-bold text-[var(--teal)] dark:text-[#FCB824] uppercase tracking-wider">
                  {t("Question")} {currentIndex + 1} {t("of")} {questions.length}
                </span>
                <span className="bg-[var(--teal)]/10 dark:bg-[#FCB824]/20 text-[var(--teal)] dark:text-amber-200 px-3.5 py-1 rounded-full text-xs font-semibold uppercase">
                  {session.sections.find((s) => s.testSectionId === currentQuestion.testSectionId)?.sectionName ?? ""}
                </span>
              </div>

              <h2 className="text-base md:text-lg font-bold text-[#00243B] dark:text-white mb-6 leading-relaxed font-sans">
                <div className="mb-2">{currentQuestion.stemText}</div>
                {language === "ta" && currentQuestion.stemTextTa && <div className="text-[var(--teal)] dark:text-[#FCB824]">{currentQuestion.stemTextTa}</div>}
              </h2>

              {stemImage && (
                <div className="mb-6">
                  <QuestionImage url={stemImage.url} altText={stemImage.altText} />
                </div>
              )}

              <div className="space-y-4">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = selectedAnswers[currentQuestion.questionId] === option.optionId;
                  const optionImage = currentQuestion.images.find((img) => img.optionId === option.optionId);
                  return (
                    <button
                      key={option.optionId}
                      onClick={() => handleSelectOption(option.optionId)}
                      className={`w-full text-left p-4.5 rounded-2xl border text-sm md:text-base font-semibold transition-all flex items-center gap-4 cursor-pointer ${
                        isSelected
                          ? "bg-amber-100/70 dark:bg-amber-900/40 border-[#FCB824] dark:border-[#FCB824] text-[#00243B] dark:text-white shadow-sm ring-2 ring-[#FCB824]/40"
                          : "border-slate-200 dark:border-slate-700 text-[#00243B] dark:text-slate-200 bg-white dark:bg-[#071d2b] hover:bg-slate-50 dark:hover:bg-[#0e3043]"
                      }`}
                    >
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? "border-[#FCB824] bg-[#FCB824] text-[#00243B]" : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {option.optionLabel || String.fromCharCode(65 + idx)}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span>{option.optionText}</span>
                        {language === "ta" && option.optionTextTa && <span className="text-[var(--teal)] dark:text-[#FCB824] opacity-90 text-sm">{option.optionTextTa}</span>}
                        {optionImage && (
                          <div className="max-w-[220px] mt-1">
                            <QuestionImage url={optionImage.url} altText={optionImage.altText} maxHeightPx={160} />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-wrap justify-between items-center gap-4 mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
            <div className="flex gap-2">
              <button
                onClick={handleToggleFlag}
                className={`px-5 py-3 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  flaggedQuestions.has(currentQuestion.questionId) ? "bg-[#FCB824] text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                <span className="material-symbols-outlined text-sm">flag</span>
                {flaggedQuestions.has(currentQuestion.questionId) ? t("Flagged for Review") : t("Flag for Review")}
              </button>

              <button
                onClick={handleClear}
                disabled={selectedAnswers[currentQuestion.questionId] === undefined}
                className="px-5 py-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:text-[#ffd15c] dark:hover:text-[#FCB824] hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-50 disabled:pointer-events-none transition-all cursor-pointer"
              >
                {t("Clear Response")}
              </button>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 px-5 py-3 rounded-xl text-xs font-bold disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              >
                {t("Previous")}
              </button>

              <button
                onClick={handleNext}
                disabled={currentIndex === questions.length - 1}
                className="bg-[var(--teal)] dark:bg-[#FCB824] text-white hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] px-5 py-3 rounded-xl text-xs font-bold disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
              >
                {t("Save & Next")}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[320px] bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-3xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm flex flex-col justify-between gap-6">
          <div>
            <div className="flex flex-wrap gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-4">
              {sectionsForTabs.map((s) => (
                <button
                  key={s.testSectionId}
                  onClick={() => setActiveSectionFilter(s.testSectionId)}
                  className={`px-3 py-1.5 text-[11px] font-bold rounded-lg transition-all ${
                    activeSectionFilter === s.testSectionId ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  {s.sectionName}
                </button>
              ))}
            </div>

            <h3 className="font-bold text-sm text-[#00243B] dark:text-white mb-1 uppercase tracking-wide">{t("Question Palette")}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-6">{t("Review answered, flagged, and skipped questions")}</p>

            <div className="grid grid-cols-5 gap-3.5">
              {questions.map((q, idx) => {
                if (activeSectionFilter !== "all" && q.testSectionId !== activeSectionFilter) return null;
                const isCurrent = idx === currentIndex;
                const isAnswered = selectedAnswers[q.questionId] !== undefined;
                const isFlagged = flaggedQuestions.has(q.questionId);
                const isVisited = visitedQuestions.has(q.questionId);

                let bgClass = "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
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

                const borderClass = isCurrent ? "ring-2 ring-sky-400 dark:ring-sky-300 ring-offset-1 dark:ring-offset-[var(--navy)] scale-110 z-10" : "border border-transparent";

                return (
                  <button
                    key={q.questionId}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-11 rounded-xl font-bold text-xs transition-all relative flex items-center justify-center cursor-pointer hover:scale-105 ${bgClass} ${borderClass}`}
                  >
                    {idx + 1}
                    {hasDot && <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-400 shadow-sm border border-violet-900"></span>}
                  </button>
                );
              })}
            </div>

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
            {saveError && <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold text-center">{saveError}</p>}
            {submitError && <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold text-center">{submitError}</p>}
            <button
              onClick={handleTriggerSubmit}
              disabled={isSubmitting}
              className="w-full py-4 bg-[#ffd15c] hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wide rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t("Submitting...") : t("Submit Test?")}
            </button>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to exit the test? Your current progress will be lost.")) {
                  onCancel();
                }
              }}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wide rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-center block"
            >
              {t("Exit Lobby")}
            </button>
          </div>
        </div>
      </main>

      <footer className="h-16 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-[#031824] mt-auto">
        <p className="text-sm text-slate-700 dark:text-slate-300 font-semibold bg-slate-200 dark:bg-slate-800/80 px-4 py-1.5 rounded-md">© 2026 Lumen Academy. All rights reserved.</p>
      </footer>

      {showSubmitModal && (
        <Modal onClose={() => setShowSubmitModal(false)}>
          <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white w-full max-w-lg rounded-[36px] md:rounded-[48px] p-8 md:p-12 shadow-2xl flex flex-col items-center text-center border border-slate-200 dark:border-slate-700">
            <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-6 md:mb-8 animate-bounce ${unansweredCount > 0 ? "bg-red-100 dark:bg-red-950/60" : "bg-emerald-100 dark:bg-emerald-950/60"}`}>
              <span className={`material-symbols-outlined text-[40px] md:text-[48px] ${unansweredCount > 0 ? "text-red-500 dark:text-red-400" : "text-emerald-500 dark:text-emerald-400"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {unansweredCount > 0 ? "warning" : "check_circle"}
              </span>
            </div>

            <h2 className="font-sans font-extrabold text-3xl md:text-4xl text-[#00243B] dark:text-white mb-2">{t("Submit Test?")}</h2>

            <div className="text-slate-600 dark:text-slate-300 text-sm md:text-base mb-8 md:mb-10 leading-relaxed font-sans font-medium space-y-3">
              {unansweredCount > 0 ? (
                <p>
                  {language === "en" ? (
                    <>
                      You have <span className="font-extrabold text-red-500 dark:text-red-400">{unansweredCount} unanswered questions</span> remaining. If you submit now, these will be marked as skipped.
                    </>
                  ) : (
                    <>
                      உங்களிடம் <span className="font-extrabold text-red-500 dark:text-red-400">{unansweredCount} பதிலளிக்கப்படாத கேள்விகள்</span> உள்ளன. இப்போது சமர்ப்பித்தால், இவை தவிர்க்கப்பட்டதாகக் கருதப்படும்.
                    </>
                  )}
                </p>
              ) : (
                <p>
                  {language === "en" ? (
                    <>
                      You have <span className="font-extrabold text-emerald-500 dark:text-emerald-400">answered all questions</span>. Are you sure you want to submit the test?
                    </>
                  ) : (
                    <>
                      நீங்கள் <span className="font-extrabold text-emerald-500 dark:text-emerald-400">அனைத்து கேள்விகளுக்கும் பதிலளித்துவிட்டீர்கள்</span>. தேர்வை சமர்ப்பிக்க வேண்டுமா?
                    </>
                  )}
                </p>
              )}
            </div>

            <div className="w-full space-y-3">
              <button
                onClick={handleSubmitAnyway}
                className={`w-full py-4 text-white font-bold text-base md:text-lg rounded-2xl shadow-lg transition-all cursor-pointer ${
                  unansweredCount > 0 ? "bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700" : "bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700"
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
        </Modal>
      )}
    </div>
  );
}
