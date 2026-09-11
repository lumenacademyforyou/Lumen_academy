import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";

import { ChapterGoal, CatalogTree, CatalogUnit, SessionResult, SessionLine, SubjectCode, UnitAccuracy } from "../types";
import { createSession } from "../services/sessionApi";
import { useDashboardAnalytics } from "../hooks/useDashboardAnalytics";
import { listMyCustomTasks, createCustomTask, updateCustomTask, deleteCustomTask, CustomTask } from "../services/customTasksApi";
import { listMyRevisionNotes, createRevisionNote, updateRevisionNote, deleteRevisionNote, RevisionNote } from "../services/revisionNotesApi";
import {
  getMyStudyPlan,
  saveMyStudyPlan,
  resetMyStudyPlan,
  listStudyPlanGoals,
  addStudyPlanGoal,
  updateStudyPlanGoal,
  deleteStudyPlanGoal,
  reorderStudyPlanGoals,
  StudyPlanGoal,
} from "../services/studyPlanApi";

interface StudyPlanProps {
  studentName?: string;
  chapterGoals?: ChapterGoal[];
  setChapterGoals?: React.Dispatch<React.SetStateAction<ChapterGoal[]>>;
  catalogTree?: CatalogTree | null;
  onSessionCreated?: (session: SessionResult) => void;
  onNavigateTab?: (tab: string) => void;
}

// LA-APP-COMPLETION-001 Phase D9: the study-plan "Build Test" handoff. A
// ChapterGoal's subject/chapter are plain strings (this screen's own local
// state, not catalog uuids), so launching a real test for one needs a
// best-effort name match against the live catalog — same approach as
// CoursesView.tsx's unit mocks, duplicated locally rather than shared since
// these are two independent page-level concerns matching against the same
// public CatalogTree shape.
const SUBJECT_TO_CODE: Record<string, SubjectCode> = { Physics: "PHY", Chemistry: "CHEM", Botany: "BOT", Zoology: "ZOO" };

function normalizeWords(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
}

// BUG-19 — learn.study_plan_goal's server row shape mapped onto the
// screen's existing ChapterGoal shape, so the rest of the app (App.tsx's
// isSyllabusCompleted gate, CourseAreaView.tsx's prop drilling) keeps
// working against real data without needing to know about the API at all.
function goalToChapterGoal(g: StudyPlanGoal): ChapterGoal {
  return {
    id: g.goal_id,
    subject: g.subject as ChapterGoal["subject"],
    chapter: g.chapter,
    highYieldTag: g.high_yield_tag ?? "",
    hoursNeeded: g.hours_needed ?? 0,
    completed: g.is_completed,
  };
}

function findBestMatchingUnit(units: CatalogUnit[], name: string): CatalogUnit | null {
  const target = new Set(normalizeWords(name));
  let best: { unit: CatalogUnit; score: number } | null = null;
  for (const u of units) {
    const score = normalizeWords(u.title).filter((w) => target.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { unit: u, score };
  }
  return best?.unit ?? null;
}

// LA-APP-COMPLETION-001 Phase G, G5 — the reverse direction of the match
// above: a real catalog nodeId -> which ChapterGoal it belongs to, so a
// chapter's card can show its own real, SQL-aggregated test performance
// (db/assess/analytics/dashboard.ts's per-unit accuracy) instead of staying
// silent. Deliberately additive, not a replacement for the manual
// `completed` toggle: this screen has no reliable way to know a study
// session happened outside of a test (reading NCERT, watching a video), so
// auto-flipping `completed` from accuracy alone would overwrite the
// student's own tracking with an incomplete proxy for it. Showing both side
// by side (manual completion + real tested accuracy) closes the test-layer
// -> course-layer loop the directive asks for without guessing at a
// completion rule nothing in this codebase specifies.
function findMatchingUnitAccuracy(goal: ChapterGoal, unitAccuracy: UnitAccuracy[]): UnitAccuracy | null {
  const subjectCode = SUBJECT_TO_CODE[goal.subject];
  if (!subjectCode) return null;
  const candidates = unitAccuracy.filter((u) => u.subjectCode === subjectCode);
  const target = new Set(normalizeWords(goal.chapter));
  let best: { unit: UnitAccuracy; score: number } | null = null;
  for (const u of candidates) {
    const score = normalizeWords(u.unitTitle).filter((w) => target.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { unit: u, score };
  }
  return best?.unit ?? null;
}

export interface DayRoutine {
  timeSlot: string;
  subject: "Physics" | "Chemistry" | "Biology" | "Mock Test";
  activity: string;
  badgeColor: string;
}

export default function StudyPlanView({

  studentName = "Aspirant",
  chapterGoals: externalChapterGoals,
  setChapterGoals: setExternalChapterGoals,
  catalogTree,
  onSessionCreated,
  onNavigateTab,
}: StudyPlanProps) {
  const { t, language } = useLanguage();
  // Config state
  const [targetExamYear, setTargetExamYear] = useState<"NEET 2026" | "NEET 2027">("NEET 2026");
  const [currentScoreLevel, setCurrentScoreLevel] = useState<"below_450" | "450_550" | "550_650" | "650_plus">("550_650");
  const [dailyHours, setDailyHours] = useState<number>(10);
  const [focusArea, setFocusArea] = useState<"physics_numericals" | "organic_chem" | "biology_ncert" | "full_720">("full_720");
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [resettingPlan, setResettingPlan] = useState(false);

  // BUG-19 — real, server-backed plan (learn.study_plan). planId is null
  // until the very first save, matching "create once": nothing is inserted
  // just from viewing this screen.
  const [planId, setPlanId] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [newGoalSubject, setNewGoalSubject] = useState<ChapterGoal["subject"]>("Physics");
  const [newGoalChapter, setNewGoalChapter] = useState("");

  const [localChapterGoals, setLocalChapterGoals] = useState<ChapterGoal[]>([]);
  const chapterGoals = externalChapterGoals || localChapterGoals;
  const setChapterGoals = setExternalChapterGoals || setLocalChapterGoals;

  // Custom User CRUD State (Tasks & Notes) — BUG-20/21, real server-side
  // persistence (learn.custom_task / learn.revision_note), replacing the
  // Supabase calls that pointed at tables that were never migrated.
  const [customTasks, setCustomTasks] = useState<CustomTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskSubject, setNewTaskSubject] = useState("Physics");

  const [customNotes, setCustomNotes] = useState<RevisionNote[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteSubject, setNewNoteSubject] = useState("Botany");
  const [newNoteTopic, setNewNoteTopic] = useState("");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteSearchQuery, setNoteSearchQuery] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const plan = await getMyStudyPlan();
        if (cancelled) return;
        if (plan) {
          setPlanId(plan.plan_id);
          const cfg = plan.config ?? {};
          if (typeof cfg.targetExamYear === "string") setTargetExamYear(cfg.targetExamYear as "NEET 2026" | "NEET 2027");
          if (typeof cfg.currentScoreLevel === "string") setCurrentScoreLevel(cfg.currentScoreLevel as typeof currentScoreLevel);
          if (typeof cfg.dailyHours === "number") setDailyHours(cfg.dailyHours);
          if (typeof cfg.focusArea === "string") setFocusArea(cfg.focusArea as typeof focusArea);
          const goals = await listStudyPlanGoals(plan.plan_id);
          if (!cancelled) setChapterGoals(goals.map(goalToChapterGoal));
        }
      } catch (err) {
        console.error("Failed to load study plan:", err);
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listMyCustomTasks().then(setCustomTasks).catch((err) => console.error("Failed to load custom tasks:", err));
    listMyRevisionNotes().then(setCustomNotes).catch((err) => console.error("Failed to load revision notes:", err));
  }, []);

  // BUG-21 — autosave: once an existing note is open for editing, every
  // keystroke debounce-saves it server-side instead of requiring an explicit
  // "Update Note" click. A brand-new note still needs one explicit "Save
  // Note" click first (there's nothing to attach a debounce to before it
  // has an id) — after that, editing it again autosaves the same way.
  useEffect(() => {
    if (!editingNoteId) return;
    setAutosaveStatus("saving");
    const timeout = setTimeout(async () => {
      try {
        const updated = await updateRevisionNote(editingNoteId, {
          title: newNoteTitle.trim() || "Untitled Note",
          content: newNoteContent,
          subject: newNoteSubject,
          topic: newNoteTopic.trim() || undefined,
        });
        setCustomNotes((prev) => prev.map((n) => (n.note_id === updated.note_id ? updated : n)));
        setAutosaveStatus("saved");
      } catch (err) {
        console.error("Autosave failed:", err);
        setAutosaveStatus("idle");
      }
    }, 800);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newNoteTitle, newNoteContent, newNoteSubject, newNoteTopic, editingNoteId]);

  const currentPlanConfig = () => ({ targetExamYear, currentScoreLevel, dailyHours, focusArea });

  const handleSavePlan = async () => {
    setSavingPlan(true);
    try {
      const plan = await saveMyStudyPlan(currentPlanConfig());
      setPlanId(plan.plan_id);
      // Always resync from the server rather than gating on chapterGoals
      // being "empty" — when chapterGoals comes from App.tsx's external
      // prop (the normal case), it starts pre-populated with its own
      // placeholder defaults, so an emptiness check would never fire and a
      // brand-new plan's real, server-seeded goals would never load in.
      const goals = await listStudyPlanGoals(plan.plan_id);
      setChapterGoals(goals.map(goalToChapterGoal));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save study plan:", err);
    } finally {
      setSavingPlan(false);
    }
  };

  // BUG-19 — explicit "Reset plan": archives the current plan and starts a
  // fresh one with the default checklist, rather than leaving a user
  // permanently stuck with a bad first attempt.
  const handleResetPlan = async () => {
    if (typeof window !== "undefined" && !window.confirm("This archives your current plan and starts a fresh one with the default chapter checklist. Continue?")) {
      return;
    }
    setResettingPlan(true);
    try {
      const plan = await resetMyStudyPlan(currentPlanConfig());
      setPlanId(plan.plan_id);
      const goals = await listStudyPlanGoals(plan.plan_id);
      setChapterGoals(goals.map(goalToChapterGoal));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to reset study plan:", err);
    } finally {
      setResettingPlan(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const task = await createCustomTask({ title: newTaskTitle.trim(), subject: newTaskSubject });
      setCustomTasks((prev) => [task, ...prev]);
      setNewTaskTitle("");
    } catch (err) {
      console.error("Failed to add task:", err);
    }
  };

  const handleToggleTask = async (task: CustomTask) => {
    const nextCompleted = !task.is_completed;
    setCustomTasks((prev) => prev.map((t) => (t.task_id === task.task_id ? { ...t, is_completed: nextCompleted } : t)));
    try {
      const updated = await updateCustomTask(task.task_id, { is_completed: nextCompleted });
      setCustomTasks((prev) => prev.map((t) => (t.task_id === updated.task_id ? updated : t)));
    } catch (err) {
      console.error("Failed to update task:", err);
      setCustomTasks((prev) => prev.map((t) => (t.task_id === task.task_id ? task : t)));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const prevTasks = customTasks;
    setCustomTasks((prev) => prev.filter((t) => t.task_id !== taskId));
    try {
      await deleteCustomTask(taskId);
    } catch (err) {
      console.error("Failed to delete task:", err);
      setCustomTasks(prevTasks);
    }
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim()) return;
    if (editingNoteId) {
      // Autosave (above) already persisted the latest edit — just close the editor.
      setEditingNoteId(null);
      setNewNoteTitle("");
      setNewNoteContent("");
      setNewNoteTopic("");
      setAutosaveStatus("idle");
      return;
    }
    try {
      const note = await createRevisionNote({
        title: newNoteTitle.trim(),
        content: newNoteContent.trim(),
        subject: newNoteSubject,
        topic: newNoteTopic.trim() || undefined,
      });
      setCustomNotes((prev) => [note, ...prev]);
      setNewNoteTitle("");
      setNewNoteContent("");
      setNewNoteTopic("");
    } catch (err) {
      console.error("Failed to save note:", err);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const prevNotes = customNotes;
    setCustomNotes((prev) => prev.filter((n) => n.note_id !== noteId));
    try {
      await deleteRevisionNote(noteId);
    } catch (err) {
      console.error("Failed to delete note:", err);
      setCustomNotes(prevNotes);
    }
  };

  const filteredNotes = customNotes.filter((n) => {
    if (!noteSearchQuery.trim()) return true;
    const q = noteSearchQuery.toLowerCase();
    return (
      n.title.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      (n.subject ?? "").toLowerCase().includes(q) ||
      (n.topic ?? "").toLowerCase().includes(q)
    );
  });

  const toggleChapter = async (id: string) => {
    const goal = chapterGoals.find((g) => g.id === id);
    if (!goal || !planId) return;
    const nextCompleted = !goal.completed;
    setChapterGoals((prev) => prev.map((g) => (g.id === id ? { ...g, completed: nextCompleted } : g)));
    try {
      await updateStudyPlanGoal(planId, id, { is_completed: nextCompleted });
    } catch (err) {
      console.error("Failed to update goal:", err);
      setChapterGoals((prev) => prev.map((g) => (g.id === id ? { ...g, completed: !nextCompleted } : g)));
    }
  };

  // BUG-19 — "add/remove/reorder items." Reordering uses simple move-up/
  // move-down buttons rather than drag-and-drop, avoiding a new dependency
  // for a checklist that's typically under a dozen items.
  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalChapter.trim() || !planId) return;
    try {
      const goal = await addStudyPlanGoal(planId, { subject: newGoalSubject, chapter: newGoalChapter.trim() });
      setChapterGoals((prev) => [...prev, goalToChapterGoal(goal)]);
      setNewGoalChapter("");
    } catch (err) {
      console.error("Failed to add goal:", err);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!planId) return;
    const prevGoals = chapterGoals;
    setChapterGoals((prev) => prev.filter((g) => g.id !== goalId));
    try {
      await deleteStudyPlanGoal(planId, goalId);
    } catch (err) {
      console.error("Failed to delete goal:", err);
      setChapterGoals(prevGoals);
    }
  };

  const handleMoveGoal = async (goalId: string, direction: "up" | "down") => {
    if (!planId) return;
    const idx = chapterGoals.findIndex((g) => g.id === goalId);
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (idx === -1 || swapWith < 0 || swapWith >= chapterGoals.length) return;
    const reordered = [...chapterGoals];
    [reordered[idx], reordered[swapWith]] = [reordered[swapWith], reordered[idx]];
    setChapterGoals(reordered);
    try {
      await reorderStudyPlanGoals(planId, reordered.map((g) => g.id));
    } catch (err) {
      console.error("Failed to reorder goals:", err);
    }
  };

  const completedCount = chapterGoals.filter((g) => g.completed).length;
  const progressPercent = chapterGoals.length > 0 ? Math.round((completedCount / chapterGoals.length) * 100) : 0;

  // Phase G, G5 — real per-chapter tested performance, matched by subject +
  // title against the live analytics endpoint's per-unit accuracy.
  const { analytics } = useDashboardAnalytics();

  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Daily-routine "Start Session" buttons are tied to a slot's subject, not
  // a specific chapter. "Biology" isn't a real catalog subject (the bank
  // splits it Botany/Zoology) — represented as one mixed two-line session.
  const handleStartSubjectSession = async (subjectLabel: "Physics" | "Chemistry" | "Biology" | "Mock Test") => {
    if (!catalogTree || !onSessionCreated) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      let session: SessionResult;
      if (subjectLabel === "Mock Test") {
        session = await createSession({ mode: "full-mock", title: "Full Mock Test" });
      } else if (subjectLabel === "Biology") {
        const lines: SessionLine[] = catalogTree.subjects
          .filter((s) => s.subjectCode === "BOT" || s.subjectCode === "ZOO")
          .map((s) => ({ subjectId: s.subjectId, includeDescendants: true, pickCount: 10, sectionName: s.subjectCode }));
        if (lines.length === 0) throw new Error("No Biology content published yet.");
        session = await createSession({ mode: "custom", title: "Biology Practice Session", durationMinutes: lines.length * 10, lines });
      } else {
        const subject = catalogTree.subjects.find((s) => s.subjectCode === SUBJECT_TO_CODE[subjectLabel]);
        if (!subject) throw new Error(`No published ${subjectLabel} content yet.`);
        session = await createSession({ mode: "subject-wise", title: `${subjectLabel} Practice Session`, durationMinutes: 20, subjectId: subject.subjectId, pickCount: 20 });
      }
      onSessionCreated(session);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Could not start this session.");
    } finally {
      setLaunching(false);
    }
  };

  // "Test Completed Chapters Now" — one line per completed chapter, matched
  // to the closest real catalog unit by title.
  const handleTestCompletedChapters = async () => {
    if (!catalogTree || !onSessionCreated) return;
    const completed = chapterGoals.filter((g) => g.completed);
    if (completed.length === 0) {
      setLaunchError("Mark at least one chapter as completed first.");
      return;
    }
    setLaunching(true);
    setLaunchError(null);
    try {
      const lines: SessionLine[] = [];
      for (const goal of completed) {
        const subject = catalogTree.subjects.find((s) => s.subjectCode === SUBJECT_TO_CODE[goal.subject]);
        if (!subject) continue;
        const matched = findBestMatchingUnit(subject.units, goal.chapter);
        lines.push({ subjectId: subject.subjectId, syllabusNodeId: matched?.nodeId, includeDescendants: true, pickCount: 5, sectionName: goal.chapter });
      }
      if (lines.length === 0) throw new Error("Could not match your completed chapters to published content yet.");
      const session = await createSession({ mode: "custom", title: "Completed Chapters Test", durationMinutes: lines.length * 5, lines });
      onSessionCreated(session);
    } catch (err) {
      setLaunchError(err instanceof Error ? err.message : "Could not start this test.");
    } finally {
      setLaunching(false);
    }
  };

  // Dynamic Routine based on daily hours & focus area
  const getDailySchedule = (): DayRoutine[] => {
    if (dailyHours <= 6) {
      return [
        { timeSlot: "06:30 AM - 08:30 AM", subject: "Physics", activity: "Formula Review & 20 High-Yield Numericals", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "09:30 AM - 11:30 AM", subject: "Biology", activity: "Line-by-Line NCERT Active Recall (Botany/Zoology)", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "02:30 PM - 04:30 PM", subject: "Chemistry", activity: "Organic Reactions or Inorganic p-Block Trends", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "08:00 PM - 09:30 PM", subject: "Mock Test", activity: "Unit Practice Test & AI Error Analytics Review", badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300" },
      ];
    } else if (dailyHours <= 8) {
      return [
        { timeSlot: "06:00 AM - 08:30 AM", subject: "Physics", activity: "Core Concept Revision + 30 Advanced PYQs", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "09:30 AM - 12:00 PM", subject: "Biology", activity: "NCERT Diagrams, Flowcharts & High-Yield Bullet Points", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "02:00 PM - 04:30 PM", subject: "Chemistry", activity: "Physical Chemistry Formulas & Reaction Mechanisms", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "06:30 PM - 08:30 PM", subject: "Mock Test", activity: "Full NTA Pattern Mock & AI Weak Area Analysis", badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300" },
      ];
    } else {
      return [
        { timeSlot: "05:30 AM - 08:00 AM", subject: "Physics", activity: "Deep Mechanics / Optics Numericals & Speed Drills", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "09:00 AM - 12:00 PM", subject: "Biology", activity: "Complete Botany & Zoology NCERT Mastery (Target 360/360)", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "02:00 PM - 05:00 PM", subject: "Chemistry", activity: "Inorganic NCERT Exceptions & Organic Mechanism Speed Drills", badgeColor: "bg-amber-100 text-amber-900 border-[#FCB824]" },
        { timeSlot: "06:30 PM - 08:30 PM", subject: "Mock Test", activity: "Full 180-Question Timed Mock", badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300" },
        { timeSlot: "09:30 PM - 10:30 PM", subject: "Mock Test", activity: "AIR Diagnostic Analysis & Flashcard Review", badgeColor: "bg-purple-100 text-purple-900 border-purple-300" },
      ];
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* SECTION HEADER WITH MANDATED PHRASE */}
      <div className="bg-gradient-to-r from-[var(--navy)] via-[var(--navy)] to-[var(--teal)] rounded-[32px] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-[#FCB824]/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#FCB824]/20 text-[#FCB824] border border-[#FCB824]/40 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest backdrop-blur-md">
            <span className="material-symbols-outlined text-sm animate-pulse">stars</span>
            <span>{t("Journey to 720 starts here")}</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white leading-tight">
            {t("AI-Powered 720 Score Master Plan")}
          </h1>

          <p className="text-slate-200 text-sm md:text-base font-medium leading-relaxed">
            {t("Welcome, ")}<span className="text-[#FCB824] font-bold">{studentName}</span>{t("! Our AI model calculates your ideal study cadence, chapter sequence, and daily routine to maximize your All-India Rank (AIR).")}
          </p>

          <div className="pt-2 flex flex-wrap gap-4 text-xs font-bold text-slate-300">
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="material-symbols-outlined text-[#FCB824] text-base">verified</span>
              {t("Target Score: 720 / 720")}
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="material-symbols-outlined text-[#FCB824] text-base">schedule</span>
              {t("Optimized Time-Blocking")}
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
              <span className="material-symbols-outlined text-[#FCB824] text-base">psychology</span>
              {t("AI Weakness Remediation")}
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: PLAN CONFIGURATOR CONTROLS */}
      <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div>
            <h3 className="text-lg font-bold text-[#00243B] dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824]">tune</span>
              Calibrate Your Personalized AI Strategy
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("Adjust your prep profile to update your daily hourly routine and milestone map in real-time.")}</p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {planId && (
              <button
                onClick={handleResetPlan}
                disabled={resettingPlan || savingPlan}
                title="Archive this plan and start fresh"
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider rounded-xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-sm">restart_alt</span>
                {resettingPlan ? "Resetting..." : "Reset Plan"}
              </button>
            )}
            <button
              onClick={handleSavePlan}
              disabled={savingPlan || resettingPlan}
              className="px-5 py-2.5 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-sm">bookmark</span>
              {savingPlan ? "Saving..." : planId ? "Update My 720 Plan" : "Save My 720 Plan"}
            </button>
          </div>
        </div>

        {savedSuccess && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-[#FCB824]/40 text-amber-900 dark:text-amber-200 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
            <span className="material-symbols-outlined text-base text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
            <span>{t("Your Study Plan for 720 Marks has been activated and saved to your profile!")}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Target Exam */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">{t("Target Exam Year")}</label>
            <select
              value={targetExamYear}
              onChange={(e) => setTargetExamYear(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none cursor-pointer"
            >
              <option value="NEET 2026" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">{t("NEET 2026 (Target May 2026)")}</option>
              <option value="NEET 2027" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">{t("NEET 2027 (2-Year Roadmap)")}</option>
            </select>
          </div>

          {/* Current Score Level */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">{t("Current Score Level")}</label>
            <select
              value={currentScoreLevel}
              onChange={(e) => setCurrentScoreLevel(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none cursor-pointer"
            >
              <option value="below_450" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">{t("Below 450 Marks (Foundation Push)")}</option>
              <option value="450_550" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">450 - 550 Marks (Speed & Accuracy)</option>
              <option value="550_650" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">550 - 650 Marks (AIR Top 5000 Drive)</option>
              <option value="650_plus" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">650+ Marks (AIIMS 700+ Sprint)</option>
            </select>
          </div>

          {/* Daily Study Hours */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">{t("Daily Study Target")}</label>
            <select
              value={dailyHours}
              onChange={(e) => setDailyHours(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none cursor-pointer"
            >
              <option value={6} className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">6 Hours / Day (Focused Revision)</option>
              <option value={8} className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">{t("8 Hours / Day (Balanced Standard)")}</option>
              <option value={10} className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">10 Hours / Day (Intensive AIR Push)</option>
              <option value={12} className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">12 Hours / Day (Max Rank Marathon)</option>
            </select>
          </div>

          {/* Focus Area */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block">{t("Primary Priority Focus")}</label>
            <select
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value as any)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none cursor-pointer"
            >
              <option value="full_720" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">{t("Balanced All-Subject 720 Sprint")}</option>
              <option value="biology_ncert" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">{t("Biology 360/360 NCERT Lock")}</option>
              <option value="physics_numericals" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">{t("Physics 180 Formula & Numerical Boost")}</option>
              <option value="organic_chem" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">{t("Organic & Inorganic Chem Mastery")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* SCORE ALLOCATION BREAKDOWN TO 720 MARKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-[var(--navy)] p-6 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 relative overflow-hidden">
          <div className="w-2 h-full bg-[#FCB824] absolute left-0 top-0 bottom-0" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-[#FCB824] bg-amber-100 dark:bg-amber-950/70 px-2.5 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
              Biology Target
            </span>
            <span className="text-xl font-black text-[#00243B] dark:text-white">360 / 360 Marks</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">{t("90 Questions • 100% NCERT Line-by-Line Mastery. Biology is your rank foundation anchor.")}</p>
          <div className="text-[11px] text-amber-700 dark:text-[#FCB824] font-bold bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-800/60">
            Recommended Daily: 3.5 Hours NCERT Active Recall
          </div>
        </div>

        <div className="bg-white dark:bg-[var(--navy)] p-6 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 relative overflow-hidden">
          <div className="w-2 h-full bg-[#FCB824] absolute left-0 top-0 bottom-0" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-amber-200 bg-amber-100 dark:bg-amber-950/70 px-2.5 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
              Physics Target
            </span>
            <span className="text-xl font-black text-[#00243B] dark:text-white">{t("180 / 180 Marks")}</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">45 Questions • Master Mechanics, Electrostatics, and Optics formulas + 30 Daily PYQ Practice.</p>
          <div className="text-[11px] text-amber-800 dark:text-[#FCB824] font-bold bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-800/60">
            Recommended Daily: 3.0 Hours Formula Speed Drills
          </div>
        </div>

        <div className="bg-white dark:bg-[var(--navy)] p-6 rounded-[24px] border border-slate-200 dark:border-slate-700 shadow-sm space-y-3 relative overflow-hidden">
          <div className="w-2 h-full bg-[#FCB824] absolute left-0 top-0 bottom-0" />
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 dark:text-[#FCB824] bg-amber-100 dark:bg-amber-950/70 px-2.5 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
              Chemistry Target
            </span>
            <span className="text-xl font-black text-[#00243B] dark:text-white">{t("180 / 180 Marks")}</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">45 Questions • Organic Named Reactions + Inorganic p-Block trends & Equilibrium calculations.</p>
          <div className="text-[11px] text-amber-800 dark:text-[#FCB824] font-bold bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-100 dark:border-amber-800/60">
            Recommended Daily: 2.5 Hours Reaction Pathways
          </div>
        </div>
      </div>

      {/* DAILY HOURLY ROUTINE TIMETABLE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h3 className="text-lg font-bold text-[#00243B] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824]">schedule</span>
                AI Recommended Daily Timetable ({dailyHours} Hours/Day)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("Time-blocked routine designed for peak cognitive absorption and zero burn-out.")}</p>
            </div>
            <span className="text-xs font-bold text-[var(--teal)] dark:text-[#FCB824] bg-amber-50 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
              {targetExamYear}
            </span>
          </div>

          <div className="space-y-3">
            {getDailySchedule().map((item, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-[#071d2b] hover:bg-white dark:hover:bg-[var(--navy)] hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#00243B] dark:text-white">{item.timeSlot}</span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${item.badgeColor} dark:bg-amber-950/80 dark:text-[#FCB824] dark:border-[#FCB824]/40`}>
                      {item.subject}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 font-semibold">{item.activity}</p>
                </div>

                <button
                  onClick={() => handleStartSubjectSession(item.subject)}
                  disabled={launching || !catalogTree}
                  className="px-3.5 py-1.5 bg-white dark:bg-[var(--navy)] hover:bg-slate-100 dark:hover:bg-[#00243B] text-[var(--teal)] dark:text-[#FCB824] border border-slate-300 dark:border-slate-700 rounded-xl text-[11px] font-bold cursor-pointer transition-colors shrink-0 self-start sm:self-auto disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {launching ? "Starting..." : "Start Session"}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* WEEKLY NCERT CHAPTER GOALS & CHECKLIST */}
        <div className="lg:col-span-5 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="space-y-1 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#00243B] dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824]">checklist</span>
                Chapter Completion Goals
              </h3>
              <span className="text-xs font-black text-[var(--teal)] dark:text-[#FCB824] bg-amber-50 dark:bg-amber-950/70 px-2.5 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
                {progressPercent}% Done
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t("Mark off chapters as you complete revision & mock questions.")}</p>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
              <span>{t("Overall 720 Syllabus Milestones")}</span>
              <span>{completedCount} of {chapterGoals.length} Units Mastered</span>
            </div>
            <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-[var(--teal)] dark:bg-[#FCB824] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          {planLoading ? (
            <div className="text-xs text-slate-400 italic text-center py-6">Loading your plan...</div>
          ) : chapterGoals.length === 0 ? (
            <div className="p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800 text-center space-y-1">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No chapter goals yet.</p>
              <p className="text-[11px] text-slate-400">Click "Save My 720 Plan" above to generate your default checklist.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {chapterGoals.map((goal, idx) => {
                const tested = analytics ? findMatchingUnitAccuracy(goal, analytics.unitAccuracy) : null;
                return (
                <div
                  key={goal.id}
                  onClick={() => toggleChapter(goal.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    goal.completed
                      ? "bg-amber-50/60 dark:bg-amber-950/50 border-[#FCB824] dark:border-[#FCB824]/40 text-amber-950 dark:text-amber-200"
                      : "bg-slate-50 dark:bg-[#071d2b] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                      goal.completed ? "bg-[#FCB824] border-[#ffd15c] text-white" : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                    }`}>
                      {goal.completed && <span className="material-symbols-outlined text-sm font-bold">check</span>}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${goal.completed ? "text-amber-700 dark:text-amber-400 opacity-90" : "text-[#00243B] dark:text-white"}`}>
                        {goal.chapter}
                      </p>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{goal.subject} • {goal.hoursNeeded} Hrs Allocated</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Real tested accuracy for this unit (Phase G, G5) — only
                        shown once the student has actually attempted questions
                        from it, never a placeholder/guessed number. */}
                    {tested && tested.correct + tested.incorrect > 0 && (
                      <span
                        title={`${tested.correct} correct / ${tested.incorrect} incorrect / ${tested.unattempted} unattempted, tested`}
                        className={`text-[10px] font-black px-2 py-0.5 rounded-md border shadow-xs ${
                          tested.accuracyPercent >= 70
                            ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800"
                            : "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800"
                        }`}
                      >
                        {t("Tested")}: {tested.accuracyPercent}%
                      </span>
                    )}
                    <span className="text-[10px] font-black text-[var(--teal)] dark:text-[#FCB824] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-xs">
                      {goal.highYieldTag}
                    </span>
                    {/* BUG-19 — reorder (move up/down) + remove, each stopping
                        propagation so they don't also toggle completion. */}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleMoveGoal(goal.id, "up"); }}
                      disabled={idx === 0}
                      className="p-1 text-slate-400 hover:text-[var(--teal)] dark:hover:text-[#FCB824] disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_upward</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleMoveGoal(goal.id, "down"); }}
                      disabled={idx === chapterGoals.length - 1}
                      className="p-1 text-slate-400 hover:text-[var(--teal)] dark:hover:text-[#FCB824] disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_downward</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteGoal(goal.id); }}
                      className="p-1 text-slate-400 hover:text-rose-500"
                      title="Remove goal"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
                );
              })}
            </div>
          )}

          {planId && (
            <form onSubmit={handleAddGoal} className="flex gap-2">
              <select
                value={newGoalSubject}
                onChange={(e) => setNewGoalSubject(e.target.value as ChapterGoal["subject"])}
                className="px-2.5 py-2 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Botany">Botany</option>
                <option value="Zoology">Zoology</option>
              </select>
              <input
                type="text"
                placeholder="Add a chapter goal..."
                value={newGoalChapter}
                onChange={(e) => setNewGoalChapter(e.target.value)}
                className="flex-1 min-w-0 px-3 py-2 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white outline-none focus:border-[var(--teal)] dark:focus:border-[#FCB824]"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#00243B] dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </form>
          )}

          {launchError && <p className="text-xs text-red-600 dark:text-red-400 font-semibold text-center">{launchError}</p>}
          <button
            onClick={handleTestCompletedChapters}
            disabled={launching || !catalogTree || completedCount === 0}
            className="w-full py-3.5 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors cursor-pointer text-center flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            {launching ? "Starting..." : "Test Completed Chapters Now"}
          </button>
        </div>
      </div>

      {/* USER-CENTRIC CRUD SECTION: PERSONAL TASKS & NOTES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        {/* CUSTOM STUDY TASKS (CREATE, READ, UPDATE, DELETE) */}
        <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824]">add_task</span>
                My Custom Study Tasks
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Add, complete, or delete your custom revision targets</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              {customTasks.filter(t => t.is_completed).length}/{customTasks.length} Done
            </span>
          </div>

          <form onSubmit={handleAddTask} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Solve 30 Rotational Motion PYQs..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white outline-none focus:border-[var(--teal)] dark:focus:border-[#FCB824]"
            />
            <select
              value={newTaskSubject}
              onChange={(e) => setNewTaskSubject(e.target.value)}
              className="px-3 py-2.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
            >
              <option value="Physics">Physics</option>
              <option value="Chemistry">Chemistry</option>
              <option value="Botany">Botany</option>
              <option value="Zoology">Zoology</option>
            </select>
            <button
              type="submit"
              className="px-4 py-2.5 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer shrink-0"
            >
              Add
            </button>
          </form>

          <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
            {customTasks.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-6">No custom tasks yet. Add one above to start tracking!</p>
            ) : (
              customTasks.map((t) => (
                <div key={t.task_id} className="p-3 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(t)}
                      className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                        t.is_completed ? "bg-emerald-500 border-emerald-600 text-white" : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {t.is_completed && <span className="material-symbols-outlined text-xs">check</span>}
                    </button>
                    <span className={`text-xs font-semibold truncate transition-colors ${t.is_completed ? "text-emerald-700 dark:text-emerald-400 opacity-90" : "text-[#00243B] dark:text-white"}`}>
                      {t.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {t.subject}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(t.task_id)}
                      className="text-slate-400 hover:text-rose-500 p-1"
                      title="Delete Task"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CUSTOM PERSONAL STUDY NOTES (CREATE, READ, UPDATE, DELETE) */}
        <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-sm space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h3 className="text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824]">note_alt</span>
                My Personal Revision Notes
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Create and update your custom formulas, mnemonics, & weak points</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
              {customNotes.length} Saved
            </span>
          </div>

          <form onSubmit={handleSaveNote} className="space-y-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Note title (e.g. Optics Sign Conventions)"
                value={newNoteTitle}
                onChange={(e) => setNewNoteTitle(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white outline-none focus:border-[var(--teal)] dark:focus:border-[#FCB824]"
              />
              <select
                value={newNoteSubject}
                onChange={(e) => setNewNoteSubject(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"
              >
                <option value="Physics">Physics</option>
                <option value="Chemistry">Chemistry</option>
                <option value="Botany">Botany</option>
                <option value="Zoology">Zoology</option>
              </select>
            </div>
            {/* BUG-21 — optional topic, a finer-grained attachment than subject alone. */}
            <input
              type="text"
              placeholder="Topic (optional, e.g. Rotational Motion)"
              value={newNoteTopic}
              onChange={(e) => setNewNoteTopic(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white outline-none focus:border-[var(--teal)] dark:focus:border-[#FCB824]"
            />
            <textarea
              placeholder="Write your study notes, formulas, or key reminders here..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-[#00243B] dark:text-white outline-none focus:border-[var(--teal)] dark:focus:border-[#FCB824]"
            />
            <div className="flex items-center justify-end gap-3">
              {/* BUG-21 — visible autosave indicator while editing an existing note. */}
              {editingNoteId && (
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  {autosaveStatus === "saving" && (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                      Saving...
                    </>
                  )}
                  {autosaveStatus === "saved" && (
                    <>
                      <span className="material-symbols-outlined text-sm text-emerald-500">check_circle</span>
                      Saved
                    </>
                  )}
                </span>
              )}
              {editingNoteId && (
                <button
                  type="button"
                  onClick={() => { setEditingNoteId(null); setNewNoteTitle(""); setNewNoteContent(""); setAutosaveStatus("idle"); }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-bold"
                >
                  Done Editing
                </button>
              )}
              {!editingNoteId && (
                <button
                  type="submit"
                  className="px-4 py-2 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer"
                >
                  Save Note
                </button>
              )}
            </div>
          </form>

          {/* BUG-21 — search notes by title/content/subject. */}
          {customNotes.length > 0 && (
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base">search</span>
              <input
                type="text"
                placeholder="Search your notes..."
                value={noteSearchQuery}
                onChange={(e) => setNoteSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white outline-none focus:border-[var(--teal)] dark:focus:border-[#FCB824]"
              />
            </div>
          )}

          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {customNotes.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No custom notes yet. Save your key formulas and insights above!</p>
            ) : filteredNotes.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No notes match "{noteSearchQuery}".</p>
            ) : (
              filteredNotes.map((n) => (
                <div key={n.note_id} className="p-3.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-[#00243B] dark:text-white truncate">{n.title}</span>
                      {n.topic && <span className="text-[10px] text-slate-400 shrink-0">• {n.topic}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-[#FCB824]">
                        {n.subject}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setEditingNoteId(n.note_id); setNewNoteTitle(n.title); setNewNoteSubject(n.subject ?? "Physics"); setNewNoteTopic(n.topic ?? ""); setNewNoteContent(n.content); setAutosaveStatus("idle"); }}
                        className="text-slate-400 hover:text-[var(--teal)] dark:hover:text-[#FCB824] p-1"
                        title="Edit Note"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(n.note_id)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                        title="Delete Note"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 font-normal leading-relaxed whitespace-pre-wrap">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
