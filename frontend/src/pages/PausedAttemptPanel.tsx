import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { getEnvelope, resumeSessionById, submitAttempt } from "../services/sessionApi";
import type { AttemptEnvelope, AttemptSummary, SessionResult } from "../types";

/**
 * The partial-state screen a paused attempt opens into from View Results —
 * docs/test-engine-fix-prompt.md Defect 3: "`View Results` on an attempt in
 * `PAUSED` state routes to that paused attempt, not to a completed-results
 * screen. Show the partial state (attempted / unattempted / marked counts)
 * with `Resume` as the primary CTA and `Submit now` as secondary. Full
 * scoring UI is only reachable from `SUBMITTED`."
 *
 * Before this, View Results was a dead end for a paused attempt: the View
 * button was disabled with the tooltip "Available once scored", so a student
 * who paused a test could see that it existed and had no way to act on it
 * from this screen at all.
 *
 * **This screen never resumes the attempt just by being opened.** It reads
 * the envelope, which deliberately freezes the clock at `paused_at` for a
 * paused attempt (envelope.ts's referenceNowMs) — so looking at your own
 * progress costs you none of your remaining time. The clock only restarts
 * when Resume is actually pressed.
 */

interface Props {
  attempt: AttemptSummary;
  /** Hands a live, resumed session up to App.tsx, which owns screen routing. */
  onResume: (session: SessionResult) => void;
  onBack: () => void;
  /** Called after a successful "Submit now" so the list can refresh. */
  onSubmitted: () => void;
}

function formatRemaining(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(sec).padStart(2, "0")}s`;
}

export default function PausedAttemptPanel({ attempt, onResume, onBack, onSubmitted }: Props) {
  const { t } = useLanguage();
  const [envelope, setEnvelope] = useState<AttemptEnvelope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"resume" | "submit" | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEnvelope(attempt.attemptId)
      .then((data) => {
        if (!cancelled) setEnvelope(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this attempt.");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt.attemptId]);

  const counts = useMemo(() => {
    if (!envelope) return null;
    const total = envelope.questions.length;
    // `hasAnswered` is the server's own definition (envelope.ts), not a
    // client re-derivation from selectedOptionId — a numeric-answer question
    // is answered without any option being selected.
    const answered = envelope.responses.filter((r) => r.hasAnswered).length;
    const marked = envelope.responses.filter((r) => r.isMarkedForReview).length;
    return { total, answered, unanswered: total - answered, marked };
  }, [envelope]);

  const handleResume = async () => {
    setBusy("resume");
    setError(null);
    try {
      onResume(await resumeSessionById(attempt.attemptId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume this test.");
      setBusy(null);
    }
  };

  const handleSubmitNow = async () => {
    setBusy("submit");
    setError(null);
    try {
      await submitAttempt(attempt.attemptId);
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit this test.");
      setBusy(null);
      setConfirmSubmit(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[820px] mx-auto animate-in fade-in duration-300 pb-12">
      <button onClick={onBack} className="text-xs font-bold text-slate-500 hover:text-[var(--teal)] dark:hover:text-[#FCB824] flex items-center gap-1 cursor-pointer">
        <span className="material-symbols-outlined text-base">arrow_back</span>
        {t("Back to results")}
      </button>

      <div className="bg-white dark:bg-[var(--navy)] rounded-[28px] border border-slate-200 dark:border-slate-700 p-6 md:p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
          <h2 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{attempt.testTitle}</h2>
          <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400">{t("Paused")}</span>
        </div>
        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mb-6">
          {t("This test isn't finished yet, so there's no score to show. Pick up where you left off, or submit what you have.")}
        </p>

        {error && <div className="mb-5 p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-sm font-semibold text-rose-700 dark:text-rose-300">{error}</div>}

        {!envelope && !error && <div className="py-10 text-center text-sm text-slate-400 font-semibold">{t("Loading...")}</div>}

        {counts && envelope && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: t("Answered"), value: counts.answered, tone: "text-emerald-600 dark:text-emerald-400" },
                { label: t("Unanswered"), value: counts.unanswered, tone: "text-slate-600 dark:text-slate-300" },
                { label: t("Marked for review"), value: counts.marked, tone: "text-violet-600 dark:text-violet-400" },
                { label: t("Time left"), value: formatRemaining(envelope.remainingSeconds), tone: "text-[var(--teal)] dark:text-[#FCB824]" },
              ].map((stat) => (
                <div key={stat.label} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{stat.label}</p>
                  <p className={`text-xl font-extrabold ${stat.tone}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="mb-6">
              <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                <span>{t("Progress")}</span>
                <span>
                  {counts.answered} / {counts.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-[var(--teal)] dark:bg-[#FCB824] transition-all duration-500"
                  style={{ width: `${counts.total > 0 ? (counts.answered / counts.total) * 100 : 0}%` }}
                />
              </div>
            </div>

            {!confirmSubmit ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => void handleResume()}
                  disabled={busy !== null}
                  className="flex-1 py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl bg-[var(--teal)] dark:bg-[#FCB824] text-white hover:bg-[var(--teal-2)] shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {busy === "resume" ? t("Resuming...") : t("Resume Test")}
                </button>
                <button
                  onClick={() => setConfirmSubmit(true)}
                  disabled={busy !== null}
                  className="flex-1 py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl bg-slate-100 dark:bg-slate-800 text-[#00243B] dark:text-white border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer disabled:opacity-60"
                >
                  {t("Submit now")}
                </button>
              </div>
            ) : (
              // Submitting is irreversible and, from here, easy to hit by
              // accident on a test the student meant to come back to — so it
              // asks, and it says exactly what will be lost.
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40">
                <p className="text-sm font-bold text-amber-900 dark:text-amber-200 mb-1">{t("Submit this test now?")}</p>
                <p className="text-xs font-medium text-amber-900 dark:text-amber-200 mb-4">
                  {counts.unanswered > 0
                    ? `${counts.unanswered} ${t("questions are still unanswered and will be marked as skipped. This cannot be undone.")}`
                    : t("This cannot be undone.")}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => void handleSubmitNow()}
                    disabled={busy !== null}
                    className="flex-1 py-3 font-bold text-xs uppercase tracking-wider rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow-md transition-all cursor-pointer disabled:opacity-60"
                  >
                    {busy === "submit" ? t("Submitting...") : t("Yes, submit")}
                  </button>
                  <button
                    onClick={() => setConfirmSubmit(false)}
                    disabled={busy !== null}
                    className="flex-1 py-3 font-bold text-xs uppercase tracking-wider rounded-xl bg-white dark:bg-slate-800 text-[#00243B] dark:text-white border border-slate-300 dark:border-slate-700 hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-60"
                  >
                    {t("Cancel")}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
