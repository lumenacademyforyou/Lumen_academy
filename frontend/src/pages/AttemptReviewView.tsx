import React, { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { displayQuestionText } from "../utils/questionText";
import { getAttemptReview } from "../services/sessionApi";
import { exportAnalyticsPdf } from "../services/pdfExport";
import QuestionImage from "../components/ui/QuestionImage";
import IrtSection from "../components/ui/IrtSection";
import ReportBrandHeader from "../components/ui/ReportBrandHeader";
import ReportSummary from "../components/ui/ReportSummary";
import type { ReviewQuestion } from "../types";

interface AttemptReviewViewProps {
  attemptId: string;
  testTitle: string;
  onBack: () => void;
}

type ReviewFilter = "all" | "correct" | "incorrect" | "unattempted";

// LA-APP-COMPLETION-001 Phase G, G4 — per-attempt review: question, the
// student's response, the correct answer, and time spent, filterable by
// correct/incorrect/unattempted. Backed entirely by GET
// /assess/attempts/:id/review (db/assess/test/attempt/attempt-flow.ts's
// getReview, already built and wired in an earlier phase but never called
// from the frontend until now) — no client-side scoring, this only reads
// and filters an already-scored, server-computed result.
export default function AttemptReviewView({ attemptId, testTitle, onBack }: AttemptReviewViewProps) {
  const { t } = useLanguage();
  const [questions, setQuestions] = useState<ReviewQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [isDownloading, setIsDownloading] = useState(false);

  // P1-12: every report is downloadable as a properly branded PDF (see
  // ReportBrandHeader) — a plain DOM capture of whatever's currently
  // rendered here, same mechanism AnalyticsView's "Download PDF" already
  // uses. print:hidden controls (this button, Back) are excluded from the
  // capture by pdfExport.ts's ignoreElements.
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      await exportAnalyticsPdf("attempt-report-content", `Lumen_Academy_${testTitle.replace(/\s+/g, "_")}.pdf`);
    } catch (err) {
      console.error("Failed to download report PDF:", err);
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setQuestions(null);
    setError(null);
    getAttemptReview(attemptId)
      .then((data) => {
        if (!cancelled) setQuestions(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load this attempt's review.");
      });
    return () => {
      cancelled = true;
    };
  }, [attemptId]);

  const outcomeOf = (q: ReviewQuestion): "correct" | "incorrect" | "unattempted" =>
    q.isCorrect === null ? "unattempted" : q.isCorrect ? "correct" : "incorrect";

  const counts = questions
    ? {
        correct: questions.filter((q) => outcomeOf(q) === "correct").length,
        incorrect: questions.filter((q) => outcomeOf(q) === "incorrect").length,
        unattempted: questions.filter((q) => outcomeOf(q) === "unattempted").length,
      }
    : { correct: 0, incorrect: 0, unattempted: 0 };

  const filtered = questions?.filter((q) => filter === "all" || outcomeOf(q) === filter) ?? [];

  return (
    <div id="attempt-report-content" className="space-y-6 max-w-[1100px] mx-auto animate-in fade-in duration-300 pb-12 bg-white dark:bg-slate-900 p-4 rounded-3xl">
      <ReportBrandHeader reportTitle={testTitle} subtitle={t("Attempt Report")} />
      <div className="bg-white dark:bg-slate-800 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="print:hidden p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#00243B] dark:text-white rounded-2xl transition-all cursor-pointer flex items-center justify-center font-bold text-xs gap-2 shadow-xs"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span>{t("Back")}</span>
          </button>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--teal)] dark:text-[#FCB824] bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
              {t("Attempt Review")}
            </span>
            <h2 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white mt-1">{testTitle}</h2>
          </div>
        </div>
        <button
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className="print:hidden flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--navy)] dark:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border border-slate-200 dark:border-slate-700 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <span className={`material-symbols-outlined text-sm ${isDownloading ? "animate-spin" : ""}`}>{isDownloading ? "refresh" : "download"}</span>
          {isDownloading ? t("Generating PDF...") : t("Download Report (PDF)")}
        </button>
      </div>

      {error && (
        <div className="p-6 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-800 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {!error && !questions && (
        <div className="p-10 text-center text-slate-500 dark:text-slate-400 text-sm font-semibold">{t("Loading review...")}</div>
      )}

      {questions && (
        <>
          <div className="p-5 md:p-6 rounded-3xl bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 shadow-sm">
            <ReportSummary attemptId={attemptId} attemptedCount={counts.correct + counts.incorrect} unattemptedCount={counts.unattempted} />
          </div>

          <div className="flex flex-wrap gap-3">
            {(
              [
                ["all", t("All"), questions.length],
                ["correct", t("Correct"), counts.correct],
                ["incorrect", t("Incorrect"), counts.incorrect],
                ["unattempted", t("Unattempted"), counts.unattempted],
              ] as [ReviewFilter, string, number][]
            ).map(([key, label, count]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors ${
                  filter === key
                    ? "bg-[#00243B] dark:bg-[#FCB824] text-white dark:text-[#00243B]"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>

          <IrtSection attemptId={attemptId} />

          <div className="space-y-5">
            {filtered.map((q) => {
              const outcome = outcomeOf(q);
              const stemImage = q.images.find((img) => img.optionId === null);
              return (
                <div
                  key={q.questionId}
                  className={`p-5 md:p-6 rounded-2xl border space-y-4 bg-white dark:bg-[var(--navy)] ${
                    outcome === "correct"
                      ? "border-emerald-200 dark:border-emerald-900"
                      : outcome === "incorrect"
                        ? "border-rose-200 dark:border-rose-900"
                        : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full">
                      {q.topicTitle}
                    </span>
                    <div className="flex items-center gap-3">
                      {q.timeSpentSeconds !== null && (
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">timer</span>
                          {q.timeSpentSeconds}s
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                          outcome === "correct"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400"
                            : outcome === "incorrect"
                              ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {outcome === "correct" ? t("Correct") : outcome === "incorrect" ? t("Incorrect") : t("Unattempted")}
                        {q.marksAwarded !== null && ` (${Number(q.marksAwarded) >= 0 ? "+" : ""}${q.marksAwarded})`}
                      </span>
                    </div>
                  </div>

                  <p className="font-semibold text-sm text-[#00243B] dark:text-white">{displayQuestionText(q.stemText)}</p>
                  {stemImage && <QuestionImage url={stemImage.url} altText={stemImage.altText} />}

                  {q.options.length > 0 && (
                    <div className="space-y-2">
                      {q.options.map((opt) => {
                        const optionImage = q.images.find((img) => img.optionId === opt.optionId);
                        return (
                          <div
                            key={opt.optionId}
                            className={`p-3 rounded-xl border text-xs font-medium flex items-start gap-2 ${
                              opt.isCorrect
                                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                                : opt.wasSelected
                                  ? "border-rose-300 bg-rose-50 dark:bg-rose-950/30 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                                  : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                            }`}
                          >
                            <span className="font-bold">{opt.optionLabel}.</span>
                            <span className="flex-1">
                              {displayQuestionText(opt.optionText)}
                              {optionImage && (
                                <div className="max-w-[200px] mt-1">
                                  <QuestionImage url={optionImage.url} altText={optionImage.altText} maxHeightPx={160} />
                                </div>
                              )}
                            </span>
                            {opt.isCorrect && <span className="material-symbols-outlined text-sm">check_circle</span>}
                            {opt.wasSelected && !opt.isCorrect && <span className="material-symbols-outlined text-sm">cancel</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {(q.correctNumericValue !== null || q.studentNumericAnswer !== null) && (
                    <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                        {t("Your answer")}: {q.studentNumericAnswer ?? t("Not attempted")}
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                        {t("Correct answer")}: {q.correctNumericValue}
                      </div>
                    </div>
                  )}

                  {q.explanationText && (
                    <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs text-slate-700 dark:text-slate-300">
                      <p className="font-bold text-amber-700 dark:text-[#FCB824] uppercase text-[10px] mb-1">{t("Explanation")}</p>
                      {q.explanationText}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400 font-semibold">{t("No questions in this category.")}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
