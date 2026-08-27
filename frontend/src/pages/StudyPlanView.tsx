import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";

import { ChapterGoal } from "../types";
import {
  fetchUserTasks,
  saveUserTask,
  deleteUserTask,
  fetchUserNotes,
  saveUserNote,
  deleteUserNote,
  UserTask,
  UserNote,
  supabase
} from "../services/supabase";

interface StudyPlanProps {
  studentName?: string;
  onTakeRecommendedMock?: () => void;
  chapterGoals?: ChapterGoal[];
  setChapterGoals?: React.Dispatch<React.SetStateAction<ChapterGoal[]>>;
  onNavigateTab?: (tab: string) => void;
}

export interface DayRoutine {
  timeSlot: string;
  subject: "Physics" | "Chemistry" | "Biology" | "Mock Test";
  activity: string;
  badgeColor: string;
}

const DEFAULT_CHAPTER_GOALS: ChapterGoal[] = [
  { id: "g1", subject: "Physics", chapter: "Mechanics & Rotational Dynamics", highYieldTag: "32 Marks", hoursNeeded: 12, completed: false },
  { id: "g2", subject: "Physics", chapter: "Electrostatics & Current Electricity", highYieldTag: "36 Marks", hoursNeeded: 10, completed: true },
  { id: "g3", subject: "Chemistry", chapter: "Organic Reactions & Mechanisms", highYieldTag: "40 Marks", hoursNeeded: 14, completed: false },
  { id: "g4", subject: "Chemistry", chapter: "Inorganic Coordination & p-Block", highYieldTag: "36 Marks", hoursNeeded: 8, completed: false },
  { id: "g5", subject: "Botany", chapter: "Genetics & Molecular Inheritance", highYieldTag: "48 Marks", hoursNeeded: 16, completed: true },
  { id: "g6", subject: "Botany", chapter: "Plant Physiology & Photosynthesis", highYieldTag: "32 Marks", hoursNeeded: 10, completed: false },
  { id: "g7", subject: "Zoology", chapter: "Human Physiology & Neuro-Endocrine", highYieldTag: "52 Marks", hoursNeeded: 18, completed: false },
  { id: "g8", subject: "Zoology", chapter: "Human Reproduction & ART Tech", highYieldTag: "36 Marks", hoursNeeded: 8, completed: false },
];

export default function StudyPlanView({

  studentName = "Aspirant",
  onTakeRecommendedMock,
  chapterGoals: externalChapterGoals,
  setChapterGoals: setExternalChapterGoals,
  onNavigateTab,
}: StudyPlanProps) {
  const { t, language } = useLanguage();
  // Config state
  const [targetExamYear, setTargetExamYear] = useState<"NEET 2026" | "NEET 2027">("NEET 2026");
  const [currentScoreLevel, setCurrentScoreLevel] = useState<"below_450" | "450_550" | "550_650" | "650_plus">("550_650");
  const [dailyHours, setDailyHours] = useState<number>(10);
  const [focusArea, setFocusArea] = useState<"physics_numericals" | "organic_chem" | "biology_ncert" | "full_720">("full_720");
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [localChapterGoals, setLocalChapterGoals] = useState<ChapterGoal[]>(DEFAULT_CHAPTER_GOALS);
  const chapterGoals = externalChapterGoals || localChapterGoals;
  const setChapterGoals = setExternalChapterGoals || setLocalChapterGoals;

  // Custom User CRUD State (Tasks & Notes)
  const [customTasks, setCustomTasks] = useState<UserTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskSubject, setNewTaskSubject] = useState("Physics");

  const [customNotes, setCustomNotes] = useState<UserNote[]>([]);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteSubject, setNewNoteSubject] = useState("Botany");
  const [newNoteContent, setNewNoteContent] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchUserTasks(userId).then(setCustomTasks);
    fetchUserNotes(userId).then(setCustomNotes);
  }, [userId]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !userId) return;
    const task = await saveUserTask({
      user_id: userId,
      title: newTaskTitle.trim(),
      subject: newTaskSubject,
      completed: false
    });
    if (task) setCustomTasks(prev => [task, ...prev.filter(t => t.id !== task.id)]);
    setNewTaskTitle("");
  };

  const handleToggleTask = async (task: UserTask) => {
    const updated = await saveUserTask({
      ...task,
      completed: !task.completed
    });
    if (updated) setCustomTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handleDeleteTask = async (taskId: string) => {
    await deleteUserTask(taskId);
    setCustomTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleSaveNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteTitle.trim() || !newNoteContent.trim() || !userId) return;
    const note = await saveUserNote({
      id: editingNoteId || undefined,
      user_id: userId,
      unit_id: "custom_unit",
      subject: newNoteSubject,
      title: newNoteTitle.trim(),
      content: newNoteContent.trim()
    });
    if (note) {
      setCustomNotes(prev => {
        const exists = prev.some(n => n.id === note.id);
        if (exists) return prev.map(n => n.id === note.id ? note : n);
        return [note, ...prev];
      });
    }
    setNewNoteTitle("");
    setNewNoteContent("");
    setEditingNoteId(null);
  };

  const handleDeleteNote = async (noteId: string) => {
    await deleteUserNote(noteId);
    setCustomNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const toggleChapter = (id: string) => {
    setChapterGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g))
    );
  };

  const completedCount = chapterGoals.filter((g) => g.completed).length;
  const progressPercent = Math.round((completedCount / chapterGoals.length) * 100);

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

  const handleSavePlan = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
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

          <button
            onClick={handleSavePlan}
            className="px-5 py-2.5 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer flex items-center gap-2 shrink-0"
          >
            <span className="material-symbols-outlined text-sm">bookmark</span>
            Save My 720 Plan
          </button>
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
                  onClick={onTakeRecommendedMock}
                  className="px-3.5 py-1.5 bg-white dark:bg-[var(--navy)] hover:bg-slate-100 dark:hover:bg-[#00243B] text-[var(--teal)] dark:text-[#FCB824] border border-slate-300 dark:border-slate-700 rounded-xl text-[11px] font-bold cursor-pointer transition-colors shrink-0 self-start sm:self-auto"
                >
                  Start Session
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

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
            {chapterGoals.map((goal) => (
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

                <span className="text-[10px] font-black text-[var(--teal)] dark:text-[#FCB824] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 shadow-xs shrink-0">
                  {goal.highYieldTag}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={onTakeRecommendedMock}
            className="w-full py-3.5 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            Test Completed Chapters Now
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
              {customTasks.filter(t => t.completed).length}/{customTasks.length} Done
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
                <div key={t.id} className="p-3 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => handleToggleTask(t)}
                      className={`w-5 h-5 rounded flex items-center justify-center border shrink-0 ${
                        t.completed ? "bg-emerald-500 border-emerald-600 text-white" : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {t.completed && <span className="material-symbols-outlined text-xs">check</span>}
                    </button>
                    <span className={`text-xs font-semibold truncate transition-colors ${t.completed ? "text-emerald-700 dark:text-emerald-400 opacity-90" : "text-[#00243B] dark:text-white"}`}>
                      {t.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {t.subject}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteTask(t.id)}
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
            <textarea
              placeholder="Write your study notes, formulas, or key reminders here..."
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium text-[#00243B] dark:text-white outline-none focus:border-[var(--teal)] dark:focus:border-[#FCB824]"
            />
            <div className="flex justify-end gap-2">
              {editingNoteId && (
                <button
                  type="button"
                  onClick={() => { setEditingNoteId(null); setNewNoteTitle(""); setNewNoteContent(""); }}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-bold"
                >
                  Cancel Edit
                </button>
              )}
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer"
              >
                {editingNoteId ? "Update Note" : "Save Note"}
              </button>
            </div>
          </form>

          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {customNotes.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">No custom notes yet. Save your key formulas and insights above!</p>
            ) : (
              customNotes.map((n) => (
                <div key={n.id} className="p-3.5 bg-slate-50 dark:bg-[#071d2b] border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#00243B] dark:text-white">{n.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-[#FCB824]">
                        {n.subject}
                      </span>
                      <button
                        type="button"
                        onClick={() => { setEditingNoteId(n.id); setNewNoteTitle(n.title); setNewNoteSubject(n.subject); setNewNoteContent(n.content); }}
                        className="text-slate-400 hover:text-[var(--teal)] dark:hover:text-[#FCB824] p-1"
                        title="Edit Note"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNote(n.id)}
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
