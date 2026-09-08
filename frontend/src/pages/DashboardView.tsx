


import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion } from "motion/react";
import AnimatedCounter from "../components/ui/AnimatedCounter";
import { TestAttempt, CatalogTree, SessionResult, UnitAccuracy } from "../types";
import { DailyFlashcard } from "../components/ui/dashboard/DailyFlashcard";
import { calculateStudyStreak } from "../services/studySessionService";
import { listMyPomodoroSessions, toStudySessions } from "../services/pomodoroApi";
import { supabase } from "../services/supabase";
import { fetchMe, MeProfile } from "../services/meApi";
import { createSession } from "../services/sessionApi";
import { ApiError } from "../services/api";
import { useDashboardAnalytics } from "../hooks/useDashboardAnalytics";
// P2-13: this view now pulls in recharts + jsPDF/html2canvas (IrtSection,
// ReportSummary, PDF export) — code-split so DashboardView's own chunk (the
// very first thing loaded post-login) doesn't carry that weight for every
// user who never opens a detailed report.
const AttemptReviewView = lazy(() => import("./AttemptReviewView"));
import { pluralize } from "../utils/pluralize";
import { getMotivationalMessage } from "../utils/motivationalMessage";
import { shareElementAsImage, getLastShareFailureReason } from "../services/shareScorecard";

// Marks come off the wire as numeric strings (they are Postgres `numeric`,
// kept as strings end to end so nothing rounds them in transit). Trailing
// zeros are noise on a scorecard — "180" reads better than "180.00" — but a
// genuinely fractional award (partial credit) must keep its decimals.
function formatMarks(value: string | number | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
}

const SUBJECT_STYLE: Record<string, { icon: string; color: string; label: string }> = {
  PHY: { icon: "bolt", color: "#f59e0b", label: "Physics" },
  CHEM: { icon: "science", color: "#38bdf8", label: "Chemistry" },
  BOT: { icon: "eco", color: "#115D75", label: "Botany" },
  ZOO: { icon: "pets", color: "#7c3aed", label: "Zoology" },
};

interface DashboardViewProps {
  attempt: TestAttempt;
  studentName: string;
  onTakeTest: () => void;
  // P1-8: needed to resolve a weakest-unit's real subjectId (analytics only
  // carries subjectCode) so "Start unit test" can launch a real session
  // scoped to that exact unit, not just switch to the generic test list.
  catalogTree: CatalogTree | null;
  onSessionCreated: (session: SessionResult) => void;
}

export default function DashboardView({ attempt, studentName, onTakeTest, catalogTree, onSessionCreated }: DashboardViewProps) {
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const { t } = useLanguage();
  const [animatedScore, setAnimatedScore] = useState(0);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const { analytics } = useDashboardAnalytics();
  // BUG-23 (docs/assessment-tool-debug-plan.md) — "Tests Taken" (and every
  // other place this screen counts completed attempts) used to come from a
  // prop derived from App.tsx's client-only `attempts` array — in-memory
  // state that starts over on every reload/new device/new login and was
  // never the account's real history. Now sourced from the same real,
  // server-counted `attempt_state = 'scored'` query the rest of this
  // screen's analytics already use (db/assess/analytics/dashboard.ts).
  // `analytics` loads asynchronously — 0 until then, same as every other
  // analytics-derived number on this screen already defaults to while
  // loading (see e.g. weakestUnits below).
  const attemptsCount = analytics?.totalScoredAttempts ?? 0;

  // "Available" is TestAttempt's marker for a not-yet-taken catalog entry
  // (see database_sample/initialAttempts.ts) — the IRT/AI-diagnostic panels
  // below narrate specific numbers ("Based on your results in...") that
  // only make sense once a real attempt exists. Showing them against a
  // template attempt fabricated a performance history for users who hadn't
  // taken a test yet.
  const hasRealAttempt = attempt.date !== "Available";

  // F6 — the real, server-scored row behind the hero's numbers. Matched to
  // the attempt this screen is displaying by title where possible (the user
  // can select an older attempt from the test list), falling back to the most
  // recent scored attempt, which is what the hero shows by default. Rendered
  // with its own title and date so it can never silently claim to describe a
  // different attempt than the one it came from.
  const scorecardEntry =
    analytics?.attemptHistory.find((a) => a.testTitle === attempt.title) ?? analytics?.attemptHistory[0] ?? null;

  const [studyStreak, setStudyStreak] = useState(0);

  // F6 — the node html2canvas rasterises when the student shares their card.
  const scorecardRef = useRef<HTMLDivElement | null>(null);
  const [shareState, setShareState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const [shareError, setShareError] = useState<string | null>(null);

  const handleShareScorecard = async () => {
    if (!scorecardRef.current) return;
    setShareState("working");
    const result = await shareElementAsImage(scorecardRef.current, {
      fileName: `lumen-scorecard-${new Date().toISOString().slice(0, 10)}`,
      shareText: `I scored ${attempt.totalScore} marks with ${attempt.accuracy}% accuracy on Lumen Academy.`,
    });
    // "cancelled" is the user closing the share sheet — not a failure, and
    // not something to congratulate them for either.
    // G1 — show what actually went wrong; "couldn't create the image" with no
    // reason is what made the original failure impossible for the user to act
    // on or report usefully.
    setShareError(result === "failed" ? getLastShareFailureReason() : null);
    setShareState(result === "failed" ? "failed" : result === "cancelled" ? "idle" : "done");
    if (result !== "failed") setTimeout(() => setShareState("idle"), 2500);
  };

  // LA-UX-REFRESH-001 F10 — the "Daily Study Goal" card (a free-text goal
  // kept only in localStorage) is gone from this screen. The study-time
  // target is a real, server-stored profile field now (F2: a time tag on
  // core.student_profile.daily_study_minutes), which is where the user asked
  // for it; a second, unrelated, device-local copy of "today's goal" here was
  // never connected to anything else in the app.

  // P1-8: launches a real session scoped to exactly this weakest unit
  // (subjectId + syllabusNodeId), not a hand-off to the generic test
  // directory — the whole point of "routes directly into that unit's test".
  const [startingUnitNodeId, setStartingUnitNodeId] = useState<string | null>(null);
  const [unitStartError, setUnitStartError] = useState<string | null>(null);
  const handleStartUnitTest = async (unit: UnitAccuracy) => {
    const subject = catalogTree?.subjects.find((s) => s.subjectCode === unit.subjectCode);
    if (!subject) {
      setUnitStartError(`No published content found for ${unit.subjectCode} yet.`);
      return;
    }
    setUnitStartError(null);
    setStartingUnitNodeId(unit.nodeId);
    try {
      const session = await createSession({
        mode: "subject-wise",
        title: `${unit.unitTitle} - Unit Practice Test`,
        durationMinutes: 30,
        subjectId: subject.subjectId,
        syllabusNodeId: unit.nodeId,
        includeDescendants: true,
        pickCount: 20,
      });
      onSessionCreated(session);
    } catch (err) {
      setUnitStartError(
        err instanceof ApiError && err.code === "POOL_INSUFFICIENT"
          ? `Not enough published questions for ${unit.unitTitle} yet (${err.message}).`
          : err instanceof ApiError && err.code === "ACTIVE_ATTEMPT_EXISTS"
            ? "You already have a test in progress. Resume or submit it before starting a new one."
            : err instanceof Error
              ? err.message
              : "Could not start this unit's test."
      );
    } finally {
      setStartingUnitNodeId(null);
    }
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
      const sessions = await listMyPomodoroSessions(90);

      if (isMounted) {
        setStudyStreak(calculateStudyStreak(toStudySessions(sessions)));
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

  const maxMarks = (attempt.correctAnswers + attempt.incorrectAnswers + attempt.skippedAnswers) * 4 || 1;
  const animatedPercentage = Math.max(0, (animatedScore / maxMarks) * 100);

  // Circumference for r=110: 2 * Math.PI * 110 ≈ 691.15
  const circumference = 691.15;
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference;
  
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

  // Per-attempt review (Phase G, G4) — real, server-scored, filterable by
  // correct/incorrect/unattempted. Replaces the old "Detailed Report" full
  // page, which rendered attempt.percentile (frozen/carried-forward, never
  // real — see APP_COMPLETION_PLAN.md's Phase G notes) and attempt.
  // laggingTopics (always empty on a real attempt; no code path ever
  // populated it). This reads GET /assess/attempts/:id/review directly for
  // a specific, real attemptId instead.
  if (selectedAttemptId) {
    const historyEntry = analytics?.attemptHistory.find((a) => a.attemptId === selectedAttemptId);
    return (
      <Suspense fallback={<div className="p-10 text-center text-sm text-slate-400 font-semibold">{t("Loading...")}</div>}>
        <AttemptReviewView attemptId={selectedAttemptId} testTitle={historyEntry?.testTitle ?? attempt.title} onBack={() => setSelectedAttemptId(null)} />
      </Suspense>
    );
  }

  // P1-15: attemptHistory is most-recent-first (Phase G), so [0] is the
  // just-taken attempt this hero is already showing and [1] is the one
  // before it — real improvement, not a guess.
  const previousAccuracyPercent = analytics && analytics.attemptHistory.length > 1 ? Number(analytics.attemptHistory[1].accuracyPercent) : null;
  const motivational = hasRealAttempt
    ? getMotivationalMessage({
        studentName,
        accuracyPercent: attempt.accuracy,
        attemptsCount,
        previousAccuracyPercent,
        studyStreakDays: studyStreak,
        weakestUnitTitle: analytics && analytics.weakestUnits.length > 0 ? analytics.weakestUnits[0].unitTitle : null,
        variationSeed: attemptsCount,
      })
    : null;

  return (
    <div className="space-y-12 max-w-[1280px] mx-auto animate-in fade-in duration-500">
      
      {/* Hero Score Section */}
      <div
        ref={scorecardRef}
        className="relative overflow-hidden rounded-[32px] md:rounded-[40px] bg-[var(--navy)] p-8 md:p-12 shadow-2xl border border-[#FCB824]/20"
      >
        {/* Background ambient blurs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-primary/30 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-8 lg:gap-12">
          {/* Hero text information */}
          <div className="flex-1 text-center lg:text-left">
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-4">
              <span className="inline-block bg-white/10 text-blue-100 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">{t(hasRealAttempt ? "LATEST SCORECARD" : "GET STARTED")}</span>
              <span className="inline-flex items-center gap-1.5 bg-[#FCB824]/20 text-[#FCB824] border border-[#FCB824]/30 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide">
                <span className="material-symbols-outlined text-sm animate-pulse">stars</span>
                <span>{t("Journey to 720 starts here")}</span>
              </span>
            </div>
            {hasRealAttempt && motivational ? (
              <>
                <h1 className="font-sans font-bold text-3xl md:text-5xl text-white tracking-tight mb-4 leading-none">
                  {motivational.headline}
                </h1>
                <p className="text-blue-100 text-base md:text-lg font-normal max-w-xl opacity-90 leading-relaxed mx-auto lg:mx-0">{t("You scored")}<span className="font-bold text-white"> {attempt.totalScore} {t("marks")}</span>{t(" in ")}<span className="text-white font-semibold">{attempt.title}</span>{t(", with ")}<span className="font-bold text-white">{attempt.accuracy}{t("% accuracy")}</span>.</p>
                <p className="text-[#FCB824] text-sm md:text-base font-semibold mt-2 opacity-95">{motivational.nextStep}</p>
              </>
            ) : (
              <>
                <h1 className="font-sans font-bold text-3xl md:text-5xl text-white tracking-tight mb-4 leading-none">
                  Start your journey, {studentName}!
                </h1>
                <p className="text-blue-100 text-base md:text-lg font-normal max-w-xl opacity-90 leading-relaxed mx-auto lg:mx-0">{t("Take your first mock test to unlock your scorecard, accuracy trends, and a personalised NEET prep plan.")}</p>
                <button
                  onClick={onTakeTest}
                  className="mt-6 bg-[#fde047] text-[var(--teal)] hover:bg-[#facc15] px-8 py-3.5 rounded-2xl font-bold text-xs tracking-wider uppercase hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer inline-flex items-center gap-2"
                >
                  {t("Take Your First Test")}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </>
            )}
            
            <div className="mt-8 flex flex-wrap justify-center lg:justify-start gap-4 md:gap-6">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 min-w-[140px] md:min-w-[160px] border border-white/20 text-center">
                <span className="block text-white/70 text-[11px] font-bold tracking-wider mb-2">{t("ACCURACY")}</span>
                <AnimatedCounter value={attempt.accuracy} suffix="%" className="text-white text-2xl md:text-3xl font-bold font-sans" />
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 min-w-[140px] md:min-w-[160px] border border-white/20 text-center">
                {/* Real attempt count (Phase G) — replaces a "PERCENTILE"
                    tile that always showed either 0 or whatever the
                    previous attempt's frozen/carried-forward value was:
                    assess.scorecard.percentile is never populated anywhere
                    server-side, so nothing here was ever a real percentile. */}
                <span className="block text-white/70 text-[11px] font-bold tracking-wider mb-2">{t("TESTS TAKEN")}</span>
                <AnimatedCounter value={attemptsCount} className="text-white text-2xl md:text-3xl font-bold font-sans" />
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 md:p-6 min-w-[140px] md:min-w-[160px] border border-white/20 text-center relative overflow-hidden group">
                <div className="absolute inset-0 bg-[#FCB824]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="block text-[#FCB824] text-[11px] font-bold tracking-wider mb-2 flex justify-center items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
                  {t("STUDY STREAK")}
                </span>
                <span className="text-white text-2xl md:text-3xl font-bold font-sans flex items-baseline gap-1.5">
                  <AnimatedCounter value={studyStreak} /><span className="text-base font-normal text-white/70">{t(pluralize(studyStreak, "Day", "Days"))}</span>
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
            
            {analytics && analytics.attemptHistory.length > 0 && (
              <button
                onClick={() => setSelectedAttemptId(analytics.attemptHistory[0].attemptId)}
                className="mt-6 bg-[#fde047] text-[var(--teal)] hover:bg-[#facc15] px-8 py-3.5 rounded-2xl font-bold text-xs tracking-wider uppercase hover:scale-105 active:scale-95 transition-all shadow-xl"
              >{t("VIEW DETAILED REPORT")}</button>
            )}
          </div>
        </div>

        {/* LA-UX-REFRESH-001 F6 — the mark breakdown behind the total: how
            many questions each outcome accounted for, what the correct ones
            earned, and what the wrong ones cost. Every figure here is
            SQL-aggregated from the marks the scoring engine actually awarded
            (db/assess/analytics/dashboard.ts), so it reconciles with the
            attempt's obtained marks under any scoring rule — a client-side
            "correct x 4 - incorrect x 1" would only be right for one of
            them. */}
        {scorecardEntry && (
          <div className="relative z-10 mt-8 pt-8 border-t border-white/10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">{t("Mark Breakdown")}</p>
                <p className="text-xs font-semibold text-blue-100/90 truncate">
                  {scorecardEntry.testTitle} • {new Date(scorecardEntry.submittedAt).toLocaleDateString()}
                </p>
              </div>

              {/* Share as an image — html2canvas over the hero node above. */}
              <button
                onClick={handleShareScorecard}
                disabled={shareState === "working"}
                className="print:hidden flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[11px] font-bold uppercase tracking-wider transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shrink-0"
                title={t("Share your scorecard as an image")}
              >
                <span className={`material-symbols-outlined text-sm ${shareState === "working" ? "animate-spin" : ""}`}>
                  {shareState === "working" ? "progress_activity" : shareState === "done" ? "check" : "ios_share"}
                </span>
                {shareState === "working" ? t("Preparing...") : shareState === "done" ? t("Ready") : t("Share Scorecard")}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white/10 border border-emerald-300/25 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  {t("Correct")}
                </p>
                <p className="text-2xl font-black text-white mt-1">{scorecardEntry.correctCount}</p>
                <p className="text-[11px] font-bold text-emerald-300 mt-0.5">+{formatMarks(scorecardEntry.correctMarks)} {t("marks")}</p>
              </div>

              <div className="bg-white/10 border border-rose-300/25 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">cancel</span>
                  {t("Incorrect")}
                </p>
                <p className="text-2xl font-black text-white mt-1">{scorecardEntry.incorrectCount}</p>
                <p className="text-[11px] font-bold text-rose-300 mt-0.5">
                  {Number(scorecardEntry.penaltyMarks) > 0
                    ? `-${formatMarks(scorecardEntry.penaltyMarks)} ${t("marks lost")}`
                    : t("No negative marking")}
                </p>
              </div>

              <div className="bg-white/10 border border-white/20 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">do_not_disturb_on</span>
                  {t("Skipped")}
                </p>
                <p className="text-2xl font-black text-white mt-1">{scorecardEntry.unattemptedCount}</p>
                <p className="text-[11px] font-bold text-slate-300 mt-0.5">0 {t("marks")}</p>
              </div>

              <div className="bg-[#FCB824]/15 border border-[#FCB824]/40 rounded-2xl p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#FCB824] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">functions</span>
                  {t("Total")}
                </p>
                <p className="text-2xl font-black text-white mt-1">
                  {formatMarks(scorecardEntry.obtainedMarks)}
                  <span className="text-sm font-bold text-white/60"> / {formatMarks(scorecardEntry.totalMarks)}</span>
                </p>
                <p className="text-[11px] font-bold text-[#FCB824] mt-0.5">
                  +{formatMarks(scorecardEntry.correctMarks)} − {formatMarks(scorecardEntry.penaltyMarks)}
                </p>
              </div>
            </div>

            {shareState === "failed" && (
              <p className="text-[11px] font-semibold text-rose-300">
                {t("Couldn't create the scorecard image.")}
                {shareError ? ` ${shareError}` : ` ${t("Please try again.")}`}
              </p>
            )}
          </div>
        )}
      </div>

      {profileIncomplete && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 rounded-2xl p-4 flex items-center gap-3 text-sm font-semibold">
          <span className="material-symbols-outlined text-xl">info</span>
          {t("Your profile is incomplete — please fill in your details below to get personalized recommendations.")}
        </div>
      )}

      {/* Quick Stats Bento Grid — LA-UX-REFRESH-001 F7: moved directly
          under the hero, above Recent Achievements, so the four numbers
          that describe the last attempt sit next to the scorecard that
          produced them rather than below the achievement badges. */}
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

      <div className="grid grid-cols-1 gap-6">
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

      {/* LA-UX-REFRESH-002 G4 — the Pomodoro timer is gone from this screen.
          Focus Mode (now in the header, reachable from every tab) is the one
          study-timer surface; two of them on one page was the duplication the
          user asked to remove. The component and its session API are
          untouched — the history it already wrote is still what the study
          streak reads. DailyFlashcard takes the full width it used to share. */}
      <DailyFlashcard />

      {/* Subject Wise Performance — real, SQL-aggregated (Phase G) across
          every scored attempt the student has, not just the one just-taken
          test. Replaces a prior fixed 3-card Physics/Chemistry/Biology
          layout (which merged Botany+Zoology into one "Biology" bucket and
          rendered a "Growth Trend" number that was actually frozen/copied
          from whichever attempt came before it, never computed) with a
          dynamic map over the real 4 subjects. */}
      {analytics && analytics.subjectAccuracy.length > 0 && (
        <div>
          <div className="flex justify-between items-end mb-6 px-2">
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-on-surface tracking-tight mb-1">{t("Subject Performance")}</h2>
              <p className="text-on-surface-variant text-xs md:text-sm">{t("Real accuracy across all your scored attempts, by subject")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {analytics.subjectAccuracy.map((s, idx) => {
              const style = SUBJECT_STYLE[s.subjectCode] ?? { icon: "school", color: "#00243B", label: s.subjectName };
              return (
                <motion.div
                  key={s.subjectCode}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ y: -6 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] md:rounded-[32px] overflow-hidden shadow-sm border border-outline-variant dark:border-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
                >
                  <div className="h-2" style={{ backgroundColor: style.color }}></div>
                  <div className="p-6 md:p-8 flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-6">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center group-hover:rotate-12 transition-transform" style={{ backgroundColor: `${style.color}1a` }}>
                          <span className="material-symbols-outlined text-2xl" style={{ color: style.color, fontVariationSettings: "'FILL' 1" }}>
                            {style.icon}
                          </span>
                        </div>
                        <span className="font-sans font-bold text-lg md:text-xl dark:text-white">{t(style.label)}</span>
                      </div>
                    </div>

                    <div className="space-y-5">
                      <div>
                        <div className="flex justify-between text-xs md:text-sm mb-2 font-medium">
                          <span className="text-on-surface-variant dark:text-slate-300">{t("Accuracy Rate")}</span>
                          <span className="font-bold text-on-surface dark:text-white text-sm md:text-base">{s.accuracyPercent}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-surface-container dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${s.accuracyPercent}%`, backgroundColor: style.color }}></div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3.5 bg-surface-container-low dark:bg-slate-800/80 rounded-xl border border-outline-variant/30 dark:border-slate-700 text-xs font-semibold text-on-surface dark:text-slate-200">
                        <span>{s.correct}✓ / {s.incorrect}✗ / {s.unattempted} {t("skipped")}</span>
                        <span className="text-slate-400 dark:text-slate-500">{s.total} {t("qs")}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Recommendation Section & Lagging Topics Improvement Guide */}
      {/* Item Response Theory (IRT) Advanced Analytics */}
      

      {/* LA-UX-REFRESH-001 F8 — the Temporal Analytics panel that used to
          sit here now lives only in the Analytics tab (AnalyticsView), per
          "move temporal analytics to the analytics tab completely." It reads
          the same useDashboardAnalytics data there, so nothing was lost in
          the move — only the duplication. */}

      {/* Recent Tests + Weakest Units — real (Phase G). Replaces the fake IRT
          Profiling card (hardcoded θ=+1.84, "Top 5%", a=0.92, c=12%, static
          SVG sigmoid curve — no real IRT model exists anywhere in this
          codebase) and the "AI Diagnostic & Strategy Report" card (its body
          read from attempt.aiRecommendation.topics/potentialGain, which
          buildHonestAttemptFromScorecard in App.tsx always leaves empty/a
          naive incorrectCount*4 guess — never a real recommendation). */}
      {analytics && analytics.attemptHistory.length > 0 && (
      <>
      <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 relative overflow-hidden shadow-sm space-y-6">
        <div>
          <h3 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{t("Recent Tests")}</h3>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">{t("Every scored attempt, most recent first")}</p>
        </div>
        <div className="space-y-3">
          {analytics.attemptHistory.slice(0, 6).map((a) => (
            <div key={a.attemptId} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="min-w-0">
                <p className="font-bold text-sm text-[#00243B] dark:text-white truncate">{a.testTitle}</p>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  {a.mode.replace("-", " ")} • {new Date(a.submittedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="font-bold text-sm text-[#00243B] dark:text-white">{a.obtainedMarks}/{a.totalMarks}</p>
                  <p className="text-[10px] font-semibold text-slate-400">{a.accuracyPercent}% {t("accuracy")}</p>
                </div>
                <button
                  onClick={() => setSelectedAttemptId(a.attemptId)}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-[#00243B] dark:bg-[#FCB824] text-white dark:text-[#00243B] hover:opacity-90 transition-opacity"
                >
                  {t("View Results")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {analytics.weakestUnits.length > 0 && (
      <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-white dark:bg-[var(--navy)] border-2 border-[var(--teal)]/40 dark:border-[#FCB824]/40 relative overflow-hidden shadow-lg space-y-6">
        <div>
          <div className="flex items-center gap-3.5 mb-2">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950 rounded-full flex items-center justify-center border border-amber-200 dark:border-amber-700">
              <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                search_check
              </span>
            </div>
            <div>
              {/* BUG-30 — was "Where You're Lagging"; reworded to a motivating framing instead of naming the weakness. */}
              <h3 className="text-xl md:text-2xl font-bold text-[#00243B] dark:text-white">{t("Where to Focus Next")}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t("Real per-unit accuracy across your scored attempts, weakest first")}</p>
            </div>
          </div>
        </div>

        {unitStartError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-xs font-semibold">{unitStartError}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* P1-8: each card is its own direct link into that unit's test —
              "Start unit test" launches a real session scoped to exactly
              this subject + syllabus node, not a hand-off to the generic
              test directory. */}
          {analytics.weakestUnits.map((u) => (
            <div key={u.nodeId} className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-amber-200 dark:border-amber-950 space-y-2.5 flex flex-col justify-between">
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-[#FCB824] px-2.5 py-0.5 rounded-full border border-[#FCB824] dark:border-amber-800">
                  {u.subjectCode} • {u.tagCode}
                </span>
                <h5 className="font-bold text-sm text-[#00243B] dark:text-white">{u.unitTitle}</h5>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                  <span>{u.correct}✓ / {u.incorrect}✗ / {u.unattempted} {t("skipped")}</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">{u.accuracyPercent}% {t("accuracy")}</span>
                </div>
              </div>
              <button
                onClick={() => handleStartUnitTest(u)}
                disabled={startingUnitNodeId !== null}
                className="w-full py-2.5 mt-1 rounded-xl text-xs font-bold uppercase tracking-wider bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
              >
                {startingUnitNodeId === u.nodeId ? (
                  t("Starting...")
                ) : (
                  <>
                    {t("Start Unit Test")}
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>
      )}
      </>
      )}

    </div>
  );
}