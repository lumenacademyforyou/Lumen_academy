import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import LumenLogo from "../components/ui/LumenLogo";
import QuestionImage from "../components/ui/QuestionImage";
import Modal from "../components/layout/Modal";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../contexts/LanguageContext";
import type { EnvelopeQuestion, Scorecard, SessionResult } from "../types";
import { saveResponses, submitAttempt as submitAttemptApi, pauseAttempt as pauseAttemptApi, postAttemptEvent, type ResponseUpdate } from "../services/sessionApi";

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

type QuestionLanguage = "en" | "ta" | "bilingual";
const QUESTION_LANG_STORAGE_KEY = "lumen_question_lang";

function readStoredQuestionLanguage(): QuestionLanguage {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(QUESTION_LANG_STORAGE_KEY);
  return stored === "ta" || stored === "bilingual" ? stored : "en";
}

export default function TestTakingView({ session, onCompleteTest, onCancel, studentName }: TestTakingViewProps) {
  // `language` here is the app-wide ui_lang (BUG-16), read-only — used only
  // for this component's own chrome text (e.g. the submit-confirmation
  // dialog's bilingual copy below), same as every other screen. Never write
  // to it from here; question_lang (below) is the separate, test-only
  // control BUG-17 asks for.
  const { t, language } = useLanguage();
  // BUG-17 (docs/assessment-tool-debug-plan.md): this used to read/write the
  // same global `language` the whole app's chrome uses — flipping it here
  // silently changed the Dashboard/Header/every other screen's language too,
  // the exact "bilingual leaking app-wide" report. question_lang is a
  // separate, three-state (en/ta/bilingual) choice that exists ONLY here,
  // never touches LanguageContext, and (per the plan) is available only in
  // test/practice contexts — there is no equivalent control anywhere else.
  // Persisted so a mid-test refresh (BUG-06's resume flow) keeps the
  // student's choice instead of silently reverting to English.
  const [questionLanguage, setQuestionLanguage] = useState<QuestionLanguage>(readStoredQuestionLanguage);
  useEffect(() => {
    window.localStorage.setItem(QUESTION_LANG_STORAGE_KEY, questionLanguage);
  }, [questionLanguage]);

  const questions = useMemo(() => orderQuestions(session), [session]);

  // Test-layer hardening C4: the server has always faithfully persisted
  // selected answers, marked-for-review flags, and per-question time spent
  // (attempt_response.*, returned in the envelope) — but this component
  // never read any of it back. A student who refreshed, crashed, or resumed
  // after logout saw every question as unanswered and unflagged from
  // question 1, even though nothing was actually lost server-side and the
  // countdown clock kept running correctly the whole time. Seeded once per
  // real session.responses identity (not on every re-render) via a lazy
  // initializer plus a resync effect below for the case where the same
  // mounted component receives a different resumed attempt without
  // unmounting.
  function buildStateFromResponses() {
    const answers: Record<string, string> = {};
    const flagged = new Set<string>();
    const timeMap: Record<string, number> = {};
    for (const r of session.responses) {
      if (r.selectedOptionId) answers[r.questionId] = r.selectedOptionId;
      if (r.isMarkedForReview) flagged.add(r.questionId);
      if (r.timeSpentSeconds) timeMap[r.questionId] = r.timeSpentSeconds;
    }
    return { answers, flagged, timeMap };
  }
  function firstUnansweredIndex(orderedQuestions: EnvelopeQuestion[], answers: Record<string, string>): number {
    const idx = orderedQuestions.findIndex((q) => !answers[q.questionId]);
    return idx === -1 ? 0 : idx;
  }

  const [currentIndex, setCurrentIndex] = useState(() => firstUnansweredIndex(questions, buildStateFromResponses().answers));
  const [activeSectionFilter, setActiveSectionFilter] = useState<string>("all");

  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>(() => buildStateFromResponses().answers);
  const [flaggedQuestions, setFlaggedQuestions] = useState<Set<string>>(() => buildStateFromResponses().flagged);
  const [visitedQuestions, setVisitedQuestions] = useState<Set<string>>(() => new Set([questions[firstUnansweredIndex(questions, buildStateFromResponses().answers)]?.questionId].filter(Boolean) as string[]));
  const [questionTimeMap, setQuestionTimeMap] = useState<Record<string, number>>(() => buildStateFromResponses().timeMap);

  // Resync guard for the (less common, but real) case where this component
  // stays mounted across a resume into a *different* attempt — without this,
  // the lazy initializers above only ever run once at first mount and a
  // second attempt's saved state would never be picked up.
  const resyncedAttemptIdRef = useRef<string | null>(session.attemptId);
  useEffect(() => {
    if (resyncedAttemptIdRef.current === session.attemptId) return;
    resyncedAttemptIdRef.current = session.attemptId;
    const { answers, flagged, timeMap } = buildStateFromResponses();
    setSelectedAnswers(answers);
    setFlaggedQuestions(flagged);
    setQuestionTimeMap(timeMap);
    const idx = firstUnansweredIndex(questions, answers);
    setCurrentIndex(idx);
    setVisitedQuestions(new Set([questions[idx]?.questionId].filter(Boolean) as string[]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.attemptId]);
  const [timeRemaining, setTimeRemaining] = useState(session.remainingSeconds);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // BUG-10 (docs/assessment-tool-debug-plan.md) mobile gap found live while
  // verifying the layout fix at the plan's own 390px width: the question
  // panel and the palette panel both stacked as flex-1 on narrow screens,
  // splitting the viewport ~50/50 — the answer options were pushed
  // off-screen behind the palette's internal scroll for every question, not
  // just a long one. The plan's own BUG-10 footer spec calls for a "palette
  // toggle", not an always-visible stacked panel — this makes the palette an
  // off-canvas drawer below `lg`, so the question panel gets the full body
  // height on mobile the way it already does on desktop.
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);

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

  // BUG-05 (docs/assessment-tool-debug-plan.md): answers only reached the
  // server on this component's own 12s interval or on explicit submit —
  // switching tabs, minimising, or closing the browser inside that window
  // lost whatever hadn't been flushed yet (confirmed live: no
  // visibilitychange/beforeunload listener existed anywhere in this app
  // before this fix). This does not change exam timer policy (still running
  // in the background either way — that's a separate, open product decision,
  // not this fix) — it only makes sure an answer already picked is never
  // lost to a tab switch.
  // Test-layer hardening B4: the visibilitychange handler already existed
  // (BUG-05, above) but only ever triggered a silent autosave flush — no
  // record was kept anywhere of how many times, or for how long, a student
  // left the tab during an attempt (AUDIT.md §1.3: "not detected or not
  // logged" for integrity purposes, confirmed live). Logs tab_hidden/
  // tab_visible to the existing assess.attempt_event table via the
  // already-live POST /assess/attempts/:id/events route — best-effort
  // (fire-and-forget, errors swallowed) since a failed integrity log must
  // never block the student's own test-taking flow.
  const hiddenAtRef = useRef<number | null>(null);
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        flushDirty();
        void postAttemptEvent(session.attemptId, "tab_hidden").catch(() => {});
      } else if (document.visibilityState === "visible" && hiddenAtRef.current !== null) {
        const hiddenForMs = Date.now() - hiddenAtRef.current;
        hiddenAtRef.current = null;
        void postAttemptEvent(session.attemptId, "tab_visible", { hiddenForMs }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handleVisibilityChange);
    };
  }, [flushDirty, session.attemptId]);

  // Test-layer hardening B7: confirmed live (AUDIT.md §1.3) that no
  // beforeunload guard existed anywhere in this app — closing the tab or
  // hitting refresh during an active attempt had zero native confirmation,
  // unlike the visibilitychange/pagehide handler above (which only does a
  // background autosave flush, silently). This is genuinely client-only —
  // a closed tab has no server-side equivalent to "ask the user to
  // confirm" — the real server-side backstop for a tab that closes anyway
  // is the autosave above plus C3's expiry sweeper, not this listener.
  // Suppressed once the attempt has actually ended (submit succeeded, or
  // the user explicitly chose Exit & Pause) via exitingLifecycleRef, so a
  // legitimate, intentional exit never shows a spurious "leave site?"
  // prompt for a screen transition already in flight.
  const exitingLifecycleRef = useRef(false);
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (exitingLifecycleRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

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

  // BUG-07 (docs/assessment-tool-debug-plan.md): this control ("Exit Lobby",
  // renamed below — it was a mislabeled leftover, not actually a lobby
  // screen) used to call onCancel() directly with no server call at all,
  // which just cleared local App.tsx state and left the attempt sitting
  // in_progress server-side forever (a real, concrete path to the reported
  // "ghost test" / orphaned-attempt bugs). Flush whatever's unsaved, pause
  // the attempt server-side so it's honestly resumable, then leave — never a
  // silent client-side abandon.
  const handleExitAndPause = async () => {
    if (!confirm("Exit and pause? Your time will be paused and you can resume this test later from Previous Tests.")) return;
    exitingLifecycleRef.current = true;
    setIsExiting(true);
    try {
      await flushDirty();
      await pauseAttemptApi(session.attemptId);
    } catch {
      // Best-effort: even if the pause call fails (e.g. offline), still let
      // the user leave — staying stuck on this screen with no way out is a
      // worse outcome than an attempt that resolves itself via the server's
      // own expiry reconciliation later.
    } finally {
      onCancel();
    }
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
      // The question-language choice is deliberately test-only (BUG-17) but
      // was persisted indefinitely, so it silently carried over into the
      // *next* test too, not just surviving a mid-test refresh as intended.
      // Reset it back to English once a test actually finishes (not on
      // pause — a paused attempt is still resumed via BUG-06's flow and
      // should keep the student's choice).
      window.localStorage.removeItem(QUESTION_LANG_STORAGE_KEY);
      exitingLifecycleRef.current = true;
      onCompleteTest(scorecard, elapsedMinutes);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong submitting your test.");
      setIsSubmitting(false);
    }
  };

  // Test-layer hardening B1/B2/B10: confirmed live (AUDIT.md §1.3) that
  // nothing in this app integrates with the History API at all — the whole
  // system_check/lobby/test_taking flow is driven purely by App.tsx's
  // in-memory currentScreen state, never by navigate()/pushState. That means
  // the browser history stack at the moment a student is mid-test is
  // whatever it was *before* they even started (no entry was ever pushed for
  // entering the exam), so the first Back press has nothing exam-related to
  // return to and instead pops straight past the app into whatever came
  // before — a real, silent escape, not just a same-document route change
  // this component's own currentScreen-gated rendering could otherwise
  // absorb. Push a throwaway history entry on mount so Back/Forward always
  // has something to land on inside this same document, and route every
  // popstate (Back, Forward, or a deep link/notification tap that manipulates
  // history — B10 shares this exact root cause) through the same
  // confirm-and-pause flow the "Exit & Pause" button already uses, rather
  // than a silent no-op or an uncontrolled exit.
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const handlePopState = () => {
      if (exitingLifecycleRef.current) return;
      window.history.pushState(null, "", window.location.href);
      void handleExitAndPause();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Test-layer hardening B5: nothing prevented two tabs from loading the
  // same attempt and autosaving independently (confirmed live — last write
  // per question silently wins, with no conflict signal). A full optimistic-
  // concurrency fix needs a version column on attempt_response, out of scope
  // here; this is the cheap, client-only mitigation the audit calls for — a
  // BroadcastChannel scoped to this attemptId so any second tab for the same
  // attempt makes both tabs aware of each other and shows a visible warning,
  // instead of both silently racing with no indication anything is wrong.
  const [otherTabDetected, setOtherTabDetected] = useState(false);
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const tabId = Math.random().toString(36).slice(2);
    const channel = new BroadcastChannel(`lumen_attempt_${session.attemptId}`);
    channel.onmessage = (e) => {
      if (e.data?.tabId === tabId) return;
      setOtherTabDetected(true);
      if (e.data?.type === "announce") channel.postMessage({ type: "ack", tabId });
    };
    channel.postMessage({ type: "announce", tabId });
    return () => channel.close();
  }, [session.attemptId]);

  // Test-layer hardening B6: confirmed live (grep across frontend/src) that
  // fullscreen was never requested anywhere — there was nothing to "exit"
  // because the exam never entered fullscreen in the first place.
  //
  // Revised after a live regression report ("can't resume the paused test"):
  // this originally hard-blocked the exam behind a full-screen "Return to
  // Fullscreen" overlay whenever `document.fullscreenElement` wasn't set.
  // Two real problems with that, found live, not theoretical:
  // (1) resuming a paused attempt jumps straight from the portal's "Resume
  //     Test" modal into this component, bypassing LobbyView entirely — the
  //     only place a request was ever made — so the overlay always blocked
  //     a resumed session outright (now also fixed at the source in
  //     App.tsx's handleResumeSession, which requests fullscreen from its
  //     own real click, but that's still one specific caller remembering to
  //     do it, not a structural guarantee).
  // (2) even from a genuine click, requestFullscreen() resolves
  //     asynchronously — this component can mount and run its first render
  //     (deciding whether to show the overlay) before the browser's
  //     `fullscreenchange` event actually fires, so the overlay could flash
  //     up and block interaction for a real, successful fullscreen request
  //     that just hadn't resolved yet. Confirmed live via Playwright: a
  //     request made synchronously inside the resume click still left the
  //     overlay covering the exam moments later.
  // Hard-blocking the one thing a student is there to do (answer questions)
  // behind a browser permission that's genuinely unreliable across entry
  // paths, browsers, and timing is a worse failure mode than the anti-
  // cheating value it adds, especially with B1-B8 already covering
  // navigation/tab/API lockdown independently of fullscreen. Kept as a
  // nudge, not a lockout: still requests fullscreen best-effort on mount and
  // tracks state, but now surfaces a small dismissible-by-action banner
  // (same non-blocking pattern as B5's second-tab warning) instead of an
  // overlay — never covers or disables the question/options underneath.
  const fullscreenSupported =
    typeof document !== "undefined" && document.fullscreenEnabled !== false && typeof document.documentElement.requestFullscreen === "function";
  const [isFullscreen, setIsFullscreen] = useState(() => !fullscreenSupported || !!document.fullscreenElement);
  useEffect(() => {
    if (!fullscreenSupported) return;
    const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    if (!document.fullscreenElement) {
      // Best-effort only: covers any entry path a caller forgot to request
      // fullscreen from (or one added later). Browsers may reject this
      // silently if it isn't within a live user gesture — the banner below
      // is the guaranteed fallback either way, never a hard requirement.
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const requestFullscreen = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
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
  // BUG-17/BUG-15: see envelope.ts's completeness guarantee cited below.
  const hasCompleteTamil = !!currentQuestion.stemTextTa;
  const showEnglishText = questionLanguage !== "ta" || !hasCompleteTamil;
  const showTamilText = (questionLanguage === "ta" || questionLanguage === "bilingual") && hasCompleteTamil;

  return (
    // BUG-10 (docs/assessment-tool-debug-plan.md): this used to be
    // `min-h-screen` with the header pinned via `fixed` and the rest in
    // normal document flow — a long question (or a tall image) grew the
    // whole page, so the browser window itself scrolled and the timer/nav
    // could end up off-screen. `h-dvh` + `overflow-hidden` here (not `h-screen`
    // — `100vh` is well-documented to misbehave under mobile browser chrome,
    // per this same bug's own fix spec) makes this component's own root a
    // fixed viewport; header/footer below are normal `shrink-0` flex
    // children now (no longer `fixed`, so no more `pt-28`/`pb-24` offset
    // hacks needed), and each of the two panels inside `main` gets its own
    // internal scroll region with pinned controls — see the two panels below.
    <div className="h-dvh overflow-hidden bg-[#f8f9ff] dark:bg-[#031824] flex flex-col font-sans animate-in fade-in duration-300">
      {otherTabDetected && (
        <div className="shrink-0 z-50 bg-amber-500 text-[#00243B] text-xs md:text-sm font-bold text-center py-2 px-4">
          {t("This test is also open in another tab. Answering the same question in both tabs may cause one tab's answer to be lost — please continue in one tab only.")}
        </div>
      )}
      {fullscreenSupported && !isFullscreen && (
        <div className="shrink-0 z-50 bg-slate-700 dark:bg-slate-800 text-white text-xs md:text-sm font-semibold flex items-center justify-center gap-3 py-2 px-4">
          <span>{t("For the best exam experience, switch to fullscreen.")}</span>
          <button
            onClick={requestFullscreen}
            className="px-3 py-1 bg-[#ffd15c] hover:bg-amber-500 text-[#00243B] font-bold text-[11px] uppercase tracking-wide rounded-lg cursor-pointer shrink-0"
          >
            {t("Enter Fullscreen")}
          </button>
        </div>
      )}
      <header className="relative shrink-0 h-20 bg-white dark:bg-[var(--navy)] border-b border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between px-6 md:px-12 z-40">
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
          {/* BUG-17: question-display mode (en/ta/bilingual) — test/practice
              only, never touches the app-wide language toggle in Header.tsx. */}
          <div className="hidden md:flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shrink-0">
            {(["en", "ta", "bilingual"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setQuestionLanguage(mode)}
                className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wide transition-all cursor-pointer ${
                  questionLanguage === mode
                    ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
                title="Question display language"
              >
                {mode === "en" ? "EN" : mode === "ta" ? "TA" : "EN+TA"}
              </button>
            ))}
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

      <main className="flex-1 min-h-0 overflow-hidden px-6 md:px-12 py-8 flex flex-col lg:flex-row gap-8 max-w-[1280px] mx-auto w-full">
        <div className="flex-1 min-h-0 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8">
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
                {/* BUG-17: three real modes, not a binary toggle that just
                    appended Tamil below English whenever "ta" was picked.
                    BUG-15's server-side completeness guarantee (envelope.ts
                    only ever populates *TextTa when the whole question —
                    stem and every option — has complete Tamil) is what makes
                    !!stemTextTa a safe, sufficient completeness check here:
                    pure "ta" mode falls back to English for the whole
                    question rather than ever rendering a blank stem. */}
                {showEnglishText && <div className="mb-2">{currentQuestion.stemText}</div>}
                {showTamilText && <div className={showEnglishText ? "text-[var(--teal)] dark:text-[#FCB824]" : ""}>{currentQuestion.stemTextTa}</div>}
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
                        {showEnglishText && <span>{option.optionText}</span>}
                        {showTamilText && <span className={`opacity-90 text-sm ${showEnglishText ? "text-[var(--teal)] dark:text-[#FCB824]" : ""}`}>{option.optionTextTa}</span>}
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
          </div>

          <div className="shrink-0 flex flex-wrap justify-between items-center gap-4 px-6 md:px-8 py-4 border-t border-slate-200 dark:border-slate-700">
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

              {/* BUG-10: palette toggle, mobile only — the palette panel
                  itself is an off-canvas drawer below `lg` (see its wrapper
                  below), opened from here instead of always occupying half
                  the viewport. */}
              <button
                onClick={() => setShowPaletteMobile(true)}
                className="lg:hidden px-5 py-3 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">grid_view</span>
                {t("Palette")} ({answeredCount}/{questions.length})
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

          {/* BUG-10: Submit must stay reachable without opening the palette
              drawer on mobile — it's the single most time-critical action in
              the whole console. Desktop already shows it in the side panel
              (lg:hidden below), so this is a mobile-only duplicate, not a
              second control competing for attention on larger screens. */}
          <div className="lg:hidden shrink-0 px-6 pb-4 space-y-2">
            {saveError && <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold text-center">{saveError}</p>}
            {submitError && <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold text-center">{submitError}</p>}
            <button
              onClick={handleTriggerSubmit}
              disabled={isSubmitting}
              className="w-full py-3.5 bg-[#ffd15c] hover:bg-amber-700 text-white font-bold text-xs uppercase tracking-wide rounded-2xl shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t("Submitting...") : t("Submit Test?")}
            </button>
          </div>
        </div>

        {/* BUG-10: independent scroll container for the palette, separate
            from the question panel's own — a long question and a large
            question count (e.g. a 180-question full mock's palette grid)
            must each be able to scroll without affecting the other.
            Below `lg` this is an off-canvas drawer (see showPaletteMobile
            above) instead of a stacked flex-1 panel — sharing the viewport
            50/50 with the question panel on a phone-width screen pushed the
            answer options themselves out of view, confirmed live at the
            plan's own 390px check width. lg:flex-none restores the static
            320px column on desktop where the two panels sit side by side. */}
        {showPaletteMobile && (
          <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setShowPaletteMobile(false)} />
        )}
        <div
          className={`fixed inset-x-0 bottom-0 z-50 max-h-[80vh] rounded-t-3xl transition-transform duration-300 ${
            showPaletteMobile ? "translate-y-0" : "translate-y-full"
          } lg:static lg:z-auto lg:translate-y-0 lg:transition-none lg:max-h-none lg:rounded-3xl lg:flex-none lg:w-[320px] w-full flex-1 min-h-0 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col`}
        >
          <div className="shrink-0 flex items-center justify-between px-6 pt-4 lg:hidden">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t("Question Palette")}</span>
            <button onClick={() => setShowPaletteMobile(false)} className="p-1.5 rounded-full bg-slate-100 dark:bg-slate-800 cursor-pointer">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-6 md:p-8">
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

            <h3 className="hidden lg:block font-bold text-sm text-[#00243B] dark:text-white mb-1 uppercase tracking-wide">{t("Question Palette")}</h3>
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
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowPaletteMobile(false);
                    }}
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

          <div className="shrink-0 space-y-3 px-6 md:px-8 py-4 border-t border-slate-200 dark:border-slate-700">
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
              onClick={handleExitAndPause}
              disabled={isExiting}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wide rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-center block disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExiting ? t("Exiting...") : t("Exit & Pause Test")}
            </button>
          </div>
        </div>
      </main>

      <footer className="shrink-0 h-16 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center bg-slate-50 dark:bg-[#031824]">
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
