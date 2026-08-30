import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion } from "motion/react";
import AnimatedCounter from "../components/ui/AnimatedCounter";
import { TestAttempt, CatalogTree, SubjectCode, DifficultyBand, SessionResult, CreateSessionRequest, SessionLine } from "../types";
import { createSession, listMyAttempts } from "../services/sessionApi";
import { ApiError } from "../services/api";
import { FULL_MOCK_REQUIRES_SYLLABUS_COMPLETION } from "../config/featureFlags";
import { countLabel } from "../utils/pluralize";

interface TestListViewProps {
  attempts: TestAttempt[];
  catalogTree: CatalogTree | null;
  catalogError: string | null;
  isSyllabusCompleted: boolean;
  onSelectAttempt: (attempt: TestAttempt) => void;
  onSessionCreated: (session: SessionResult) => void;
}

const DIFFICULTY_OPTIONS: { value: DifficultyBand | undefined; label: string }[] = [
  { value: undefined, label: "Adaptive" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const QUESTION_COUNT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

// Evenly distributes `total` across `n` buckets — the last few buckets take
// the +1 remainder rather than the first, purely so smaller units (fewer
// available questions) are less likely to be asked for slightly more than
// they hold; the server's PoolInsufficientError is still the real safety net
// either way.
function distributeCount(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i >= n - remainder ? 1 : 0));
}

function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "POOL_INSUFFICIENT") {
      return `Not enough published questions for this selection (${err.message}). Try a smaller question count or different units.`;
    }
    // BUG-08 (docs/assessment-tool-debug-plan.md): "some tests do not start"
    // — the guard added for BUG-03 (at most one active attempt) is one real,
    // specific cause. Point them at the fix (the resume prompt on Dashboard)
    // instead of leaving a generic error with no next step.
    if (err.code === "ACTIVE_ATTEMPT_EXISTS") {
      return "You already have a test in progress. Go to your Dashboard to resume or submit it before starting a new one.";
    }
    // BUG-28: hiding the button is not sufficient (per the plan's own spec)
    // — StudyPlanView.tsx's "Mock Test" quick-start has no client-side gate
    // at all, so this server-side rejection is the only thing that ever
    // stops it; give it the same clear, actionable message either way.
    if (err.code === "FULL_MOCK_LOCKED") {
      return "Complete 1 practice test to unlock Full Tests.";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong. Please try again.";
}

export default function TestListView({ attempts, catalogTree, catalogError, isSyllabusCompleted, onSelectAttempt, onSessionCreated }: TestListViewProps) {
  const { t } = useLanguage();
  // P1-9: feature-flagged off — the Full Mock Test is unlocked for everyone
  // regardless of syllabus-tracker progress. Flip the flag, not this line,
  // to restore the gate. A separate, independent decision from BUG-28 below.
  const syllabusGateUnlocked = !FULL_MOCK_REQUIRES_SYLLABUS_COMPLETION || isSyllabusCompleted;
  // BUG-28 (docs/assessment-tool-debug-plan.md): real gate, not a guess —
  // starts `null` (unknown) rather than `true` so the button doesn't
  // flash "unlocked" before this resolves; only ever shown as unlocked once
  // the server-backed answer comes back. The actual enforcement lives
  // server-side (sessionController.ts's hasCompletedPracticeTest) since
  // hiding this button alone would leave StudyPlanView.tsx's ungated
  // "Mock Test" quick-start as an open bypass — this is purely so the
  // button explains itself instead of failing silently or looking broken.
  const [hasCompletedPractice, setHasCompletedPractice] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    listMyAttempts()
      .then((attempts) => {
        if (cancelled) return;
        setHasCompletedPractice(attempts.some((a) => a.mode !== "full-mock" && a.attemptState === "scored"));
      })
      .catch(() => {
        // Unknown is the safe default here — the button stays disabled
        // rather than silently unlocking on a failed fetch; the real gate
        // is server-side regardless.
        if (!cancelled) setHasCompletedPractice(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const fullMockUnlocked = syllabusGateUnlocked && hasCompletedPractice === true;
  const [view, setView] = useState<"directory" | "subject-wise" | "custom">("directory");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Subject-wise builder state
  const [swSubjectCode, setSwSubjectCode] = useState<SubjectCode | null>(null);
  const [swUnitNodeId, setSwUnitNodeId] = useState<string | "all">("all");
  const [swPickCount, setSwPickCount] = useState(20);
  const [swDifficulty, setSwDifficulty] = useState<DifficultyBand | undefined>(undefined);

  // Custom builder state
  const [customSubjectFilter, setCustomSubjectFilter] = useState<SubjectCode | "ALL">("ALL");
  const [customSelectedUnits, setCustomSelectedUnits] = useState<Set<string>>(new Set());
  const [customTotalCount, setCustomTotalCount] = useState(20);
  const [customDifficulty, setCustomDifficulty] = useState<DifficultyBand | undefined>(undefined);

  const swSubject = catalogTree?.subjects.find((s) => s.subjectCode === swSubjectCode) ?? null;
  const swUnit = swSubject?.units.find((u) => u.nodeId === swUnitNodeId) ?? null;
  const swAvailable = swUnit ? swUnit.publishedQuestionCount : (swSubject?.publishedQuestionCount ?? 0);

  const customUnitsPool = useMemo(() => {
    if (!catalogTree) return [];
    return catalogTree.subjects.filter((s) => customSubjectFilter === "ALL" || s.subjectCode === customSubjectFilter).flatMap((s) => s.units.map((u) => ({ ...u, subjectId: s.subjectId, subjectCode: s.subjectCode })));
  }, [catalogTree, customSubjectFilter]);

  async function launch(body: CreateSessionRequest) {
    setCreating(true);
    setCreateError(null);
    try {
      const session = await createSession(body);
      onSessionCreated(session);
    } catch (err) {
      setCreateError(friendlyError(err));
    } finally {
      setCreating(false);
    }
  }

  function handleStartFullMock() {
    if (!syllabusGateUnlocked) {
      setCreateError("Complete all units in your Syllabus Tracker (Study Plan) to unlock the Full Mock Test.");
      return;
    }
    if (hasCompletedPractice !== true) {
      setCreateError("Complete 1 practice test to unlock Full Tests.");
      return;
    }
    launch({ mode: "full-mock", title: "Full Mock Test" });
  }

  function handleStartSubjectWise() {
    if (!swSubject) return;
    launch({
      mode: "subject-wise",
      title: swUnit ? `${swSubject.subjectName} — ${swUnit.title}` : `${swSubject.subjectName} Practice`,
      durationMinutes: swPickCount,
      subjectId: swSubject.subjectId,
      syllabusNodeId: swUnit ? swUnit.nodeId : undefined,
      includeDescendants: true,
      difficultyBand: swDifficulty,
      pickCount: swPickCount,
    });
  }

  function handleLaunchCustom() {
    if (!catalogTree) return;
    const selectedList = customUnitsPool.filter((u) => customSelectedUnits.has(u.nodeId));
    let lines: SessionLine[];
    if (selectedList.length > 0) {
      const counts = distributeCount(customTotalCount, selectedList.length);
      lines = selectedList.map((u, i) => ({
        subjectId: u.subjectId,
        syllabusNodeId: u.nodeId,
        includeDescendants: true,
        difficultyBand: customDifficulty,
        pickCount: counts[i],
        sectionName: `${u.subjectCode} - ${u.title}`,
      }));
    } else {
      // No specific units picked — one line per subject in the active filter,
      // whole-subject (no syllabusNodeId), matching subject-wise's own
      // "no unit chosen = whole subject" default.
      const subjects = catalogTree.subjects.filter((s) => customSubjectFilter === "ALL" || s.subjectCode === customSubjectFilter);
      const counts = distributeCount(customTotalCount, subjects.length);
      lines = subjects.map((s, i) => ({
        subjectId: s.subjectId,
        includeDescendants: true,
        difficultyBand: customDifficulty,
        pickCount: counts[i],
        sectionName: s.subjectCode,
      }));
    }
    const unitsSuffix = selectedList.length > 0 ? ` [${countLabel(selectedList.length, "unit")}]` : "";
    launch({ mode: "custom", title: `Custom Test${unitsSuffix}`, durationMinutes: customTotalCount, lines });
  }

  const cardClassName =
    "bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] md:rounded-[32px] border border-slate-200 dark:border-slate-700 hover:border-[var(--teal)]/40 dark:hover:border-[#FCB824]/50 shadow-sm hover:shadow-xl transition-all duration-300 p-6 md:p-8 flex flex-col justify-between";

  if (catalogError) {
    return (
      <div className="max-w-[1280px] mx-auto p-10 text-center">
        <p className="text-red-600 dark:text-red-400 font-semibold">{catalogError}</p>
      </div>
    );
  }

  if (!catalogTree) {
    return (
      <div className="max-w-[1280px] mx-auto p-10 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-[var(--teal)] rounded-full animate-spin" />
      </div>
    );
  }

  const recentAttempts = attempts.filter((a) => a.totalScore !== undefined);

  return (
    <div className="space-y-8 max-w-[1280px] mx-auto animate-in fade-in duration-500">
      <div className="px-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-sans font-bold text-[#00243B] dark:text-white tracking-tight mb-1">{t("NEET Mock Test Series")}</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm">{t("Assembled fresh from the live question bank — every attempt is different, and questions never repeat until you've seen the whole bank.")}</p>
        </div>
        {view !== "directory" && (
          <button
            onClick={() => {
              setView("directory");
              setCreateError(null);
            }}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            {t("← Back to Test Directory")}
          </button>
        )}
      </div>

      {createError && (
        <div className="px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-sm font-semibold">{createError}</div>
      )}

      {view === "directory" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Full Mock */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -6 }} transition={{ duration: 0.3 }} className={cardClassName}>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/80 text-[var(--teal)] dark:text-[#FCB824] px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
                  {t("All Subjects")}
                </span>
                <h3 className="text-lg md:text-xl font-bold text-[#00243B] dark:text-white mt-4 mb-2">{t("Full Mock Test")}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">{t("Real NEET pattern: 45 questions per subject across Physics, Chemistry, Botany, and Zoology.")}</p>
                <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-slate-200 dark:border-slate-700 mb-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-lg">list_alt</span>
                    <span>180 {t("Questions")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-lg">schedule</span>
                    <span>180 {t("mins")}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleStartFullMock}
                disabled={creating || hasCompletedPractice === null}
                className={`w-full py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all text-center block ${
                  fullMockUnlocked ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] shadow-md hover:shadow-lg cursor-pointer" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                } disabled:opacity-60`}
              >
                {/* BUG-28: the reason a locked button is locked must always
                    be visible, never a silent disable — two independent
                    gates here, each with its own real explanation rather
                    than a generic "Locked". */}
                {hasCompletedPractice === null
                  ? t("Checking eligibility...")
                  : !syllabusGateUnlocked
                    ? t("Locked (Complete Syllabus Tracker)")
                    : !fullMockUnlocked
                      ? t("Complete 1 practice test to unlock")
                      : t("Start Full Mock Test")}
              </button>
            </motion.div>

            {/* Subject-wise */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -6 }} transition={{ duration: 0.3, delay: 0.1 }} className={cardClassName}>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/80 text-[var(--teal)] dark:text-[#FCB824] px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
                  {t("Focused Practice")}
                </span>
                <h3 className="text-lg md:text-xl font-bold text-[#00243B] dark:text-white mt-4 mb-2">{t("Subject-wise Practice")}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">{t("Drill a single subject, or one specific unit within it, at your own pace.")}</p>
                <div className="grid grid-cols-2 gap-3 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">
                  {catalogTree.subjects.map((s) => (
                    <div key={s.subjectId} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span>{s.subjectCode}</span>
                      <span className="text-[var(--teal)] dark:text-[#FCB824] font-bold">{s.publishedQuestionCount}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button onClick={() => setView("subject-wise")} className="w-full py-3.5 mt-4 bg-[var(--teal)] dark:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[var(--teal-2)] shadow-md hover:shadow-lg transition-all cursor-pointer">
                {t("Configure Practice")}
              </button>
            </motion.div>

            {/* Custom */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -6 }} transition={{ duration: 0.3, delay: 0.2 }} className={cardClassName}>
              <div>
                <span className="text-[10px] font-black text-[var(--teal)] dark:text-[#FCB824] uppercase tracking-wider bg-amber-50 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
                  {t("Custom Calibration")}
                </span>
                <h3 className="text-lg md:text-xl font-bold text-[#00243B] dark:text-white mt-4 mb-2">{t("Custom Mock Builder")}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed mb-6">{t("Pick specific units across every subject, a total question count, and a difficulty level.")}</p>
              </div>
              <button onClick={() => setView("custom")} className="w-full py-3.5 bg-[var(--teal)] dark:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[var(--teal-2)] shadow-md hover:shadow-lg transition-all cursor-pointer">
                {t("Build Custom Test")}
              </button>
            </motion.div>
          </div>

          {recentAttempts.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 px-2">{t("Recent Attempts")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {recentAttempts.slice(0, 6).map((attempt) => (
                  <button key={attempt.id} onClick={() => onSelectAttempt(attempt)} className="text-left bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-[var(--teal)]/40 transition-all">
                    <p className="text-sm font-bold text-[#00243B] dark:text-white mb-1">{attempt.title}</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 dark:text-slate-400">{attempt.date}</span>
                      <AnimatedCounter value={attempt.accuracy} suffix="% acc." className="font-bold text-[var(--teal)] dark:text-[#FCB824]" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {view === "subject-wise" && (
        <div className={cardClassName + " max-w-xl"}>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Subject")}</label>
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {catalogTree.subjects.map((s) => (
                  <button
                    key={s.subjectId}
                    onClick={() => {
                      setSwSubjectCode(s.subjectCode);
                      setSwUnitNodeId("all");
                    }}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${swSubjectCode === s.subjectCode ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#00243B]"}`}
                  >
                    {s.subjectCode}
                  </button>
                ))}
              </div>
            </div>

            {swSubject && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Unit (optional)")}</label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setSwUnitNodeId("all")}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${swUnitNodeId === "all" ? "bg-[var(--teal)] text-white border border-[var(--teal)]" : "bg-white dark:bg-[var(--navy)] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}
                  >
                    {t("All Units")} ({swSubject.publishedQuestionCount})
                  </button>
                  {swSubject.units.map((u) => (
                    <button
                      key={u.nodeId}
                      onClick={() => setSwUnitNodeId(u.nodeId)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer ${swUnitNodeId === u.nodeId ? "bg-[var(--teal)] text-white border border-[var(--teal)]" : "bg-white dark:bg-[var(--navy)] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}
                    >
                      {u.title} ({u.publishedQuestionCount})
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {t("Questions")} ({t("available")}: {swAvailable})
              </label>
              <select
                value={swPickCount}
                onChange={(e) => setSwPickCount(Number(e.target.value))}
                className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#00243B] dark:text-white"
              >
                {QUESTION_COUNT_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c} {t("Qs")}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Difficulty")}</label>
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d.label}
                    onClick={() => setSwDifficulty(d.value)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${swDifficulty === d.value ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#00243B]"}`}
                  >
                    {t(d.label)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleStartSubjectWise}
              disabled={!swSubject || creating}
              className="w-full mt-2 py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? t("Starting...") : t("Start Practice")}
            </button>
          </div>
        </div>
      )}

      {view === "custom" && (
        <div className={cardClassName + " max-w-xl"}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Focus Subject")}</label>
              <div className="grid grid-cols-5 gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {(["ALL", ...catalogTree.subjects.map((s) => s.subjectCode)] as const).map((code) => (
                  <button
                    key={code}
                    onClick={() => setCustomSubjectFilter(code)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${customSubjectFilter === code ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#00243B]"}`}
                  >
                    {code === "ALL" ? "All" : code}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {t("Select Units")} ({customSelectedUnits.size === 0 ? t("All Selected") : `${customSelectedUnits.size} ${t("Picked")}`})
                </label>
                {customSelectedUnits.size > 0 && (
                  <button onClick={() => setCustomSelectedUnits(new Set())} className="text-[10px] text-[#ffd15c] dark:text-[#FCB824] font-bold hover:underline">
                    {t("Reset Units")}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700">
                {customUnitsPool.map((u) => {
                  const isSelected = customSelectedUnits.has(u.nodeId);
                  return (
                    <button
                      key={u.nodeId}
                      onClick={() =>
                        setCustomSelectedUnits((prev) => {
                          const next = new Set(prev);
                          if (next.has(u.nodeId)) next.delete(u.nodeId);
                          else next.add(u.nodeId);
                          return next;
                        })
                      }
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected ? "bg-[var(--teal)] text-white shadow-sm border border-[var(--teal)]" : "bg-white dark:bg-[var(--navy)] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">{isSelected ? "check_box" : "check_box_outline_blank"}</span>
                      <span>
                        {u.subjectCode} — {u.title} ({u.publishedQuestionCount})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Questions")}</label>
                <select
                  value={customTotalCount}
                  onChange={(e) => setCustomTotalCount(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#00243B] dark:text-white"
                >
                  {[...QUESTION_COUNT_OPTIONS, 180].map((c) => (
                    <option key={c} value={c}>
                      {c} {t("Qs")}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Duration")}</label>
                <div className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400">
                  {customTotalCount} {t("Mins (Strict)")}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Difficulty")}</label>
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {DIFFICULTY_OPTIONS.map((d) => (
                  <button
                    key={d.label}
                    onClick={() => setCustomDifficulty(d.value)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${customDifficulty === d.value ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#00243B]"}`}
                  >
                    {t(d.label)}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleLaunchCustom}
              disabled={creating}
              className="w-full mt-2 py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? t("Starting...") : t("Launch Custom Exam")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
