import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useLanguage } from "../../contexts/LanguageContext";
import { 
  saveStudySession, 
  fetchStudySessions, 
  deleteStudySession, 
  calculateSessionStats, 
  StudySession 
} from "../../lib/studySessionService";

interface PomodoroTimerProps {
  studentName?: string;
  userId?: string;
}

type TimerMode = "focus" | "shortBreak" | "longBreak";

const MODE_PRESETS: Record<TimerMode, { label: string; defaultMinutes: number; color: string; bg: string }> = {
  focus: {
    label: "Focus Study",
    defaultMinutes: 25,
    color: "#008080", // Teal
    bg: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800"
  },
  shortBreak: {
    label: "Short Break",
    defaultMinutes: 5,
    color: "#10B981", // Emerald
    bg: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
  },
  longBreak: {
    label: "Long Break",
    defaultMinutes: 15,
    color: "#3B82F6", // Blue
    bg: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
  }
};

const SUBJECTS = [
  "Physics",
  "Chemistry",
  "Biology",
  "Mathematics",
  "NEET Mock Drill",
  "General Study"
];

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  studentName = "Student",
  userId = "demo_user"
}) => {
  const { t } = useLanguage();

  // Mode and Timer Settings
  const [mode, setMode] = useState<TimerMode>("focus");
  const [targetMinutes, setTargetMinutes] = useState<number>(25);
  const [secondsLeft, setSecondsLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("Physics");
  const [taskTitle, setTaskTitle] = useState<string>("Formula & Numerical Practice");

  // History & Logging State
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Completion / Rating Modal
  const [showLogModal, setShowLogModal] = useState<boolean>(false);
  const [loggedDuration, setLoggedDuration] = useState<number>(25);
  const [rating, setRating] = useState<number>(5);
  const [notes, setNotes] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sound synthesis using Web Audio API
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.exponentialRampToValueAtTime(1046.50, ctx.currentTime + 0.6); // C6

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // Audio fallback
    }
  };

  // Load session logs on mount
  useEffect(() => {
    loadSessions();
  }, [userId]);

  const loadSessions = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await fetchStudySessions(userId);
      setSessions(data);
    } catch (err) {
      console.error("Failed to fetch study sessions:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Handle Mode Change
  const handleModeSelect = (newMode: TimerMode) => {
    setMode(newMode);
    const preset = MODE_PRESETS[newMode].defaultMinutes;
    setTargetMinutes(preset);
    setSecondsLeft(preset * 60);
    setIsRunning(false);
  };

  // Timer Tick Interval
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setIsRunning(false);
            playChime();
            
            // Trigger log modal automatically upon completion
            const actualMinutes = targetMinutes;
            setLoggedDuration(actualMinutes);
            setShowLogModal(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, targetMinutes]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setSecondsLeft(targetMinutes * 60);
  };

  const addFiveMinutes = () => {
    setSecondsLeft((prev) => prev + 300);
    setTargetMinutes((prev) => prev + 5);
  };

  const handleCustomMinutesChange = (mins: number) => {
    const validMins = Math.max(1, Math.min(180, mins));
    setTargetMinutes(validMins);
    setSecondsLeft(validMins * 60);
    setIsRunning(false);
  };

  // Trigger early session finish & log
  const handleFinishEarly = () => {
    setIsRunning(false);
    const elapsedSeconds = (targetMinutes * 60) - secondsLeft;
    const elapsedMins = Math.max(1, Math.round(elapsedSeconds / 60));
    setLoggedDuration(elapsedMins);
    setShowLogModal(true);
  };

  // Save Session to Database
  const handleSaveLog = async () => {
    setIsSaving(true);
    try {
      const saved = await saveStudySession({
        userId,
        studentName,
        subject: selectedSubject,
        taskTitle: taskTitle.trim() || `${selectedSubject} Focus Session`,
        durationMinutes: loggedDuration,
        sessionType: mode,
        notes,
        rating
      });

      setSessions((prev) => [saved, ...prev.filter(s => s.id !== saved.id)]);
      setShowLogModal(false);
      setToastMessage(`✓ Logged ${loggedDuration} mins of ${selectedSubject} to Database!`);
      
      // Reset timer back for next session
      resetTimer();

      setTimeout(() => setToastMessage(""), 4000);
    } catch (err) {
      console.error("Failed to save study session:", err);
      setToastMessage("Failed to save study session. Saved locally.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSession = async (id?: string) => {
    if (!id) return;
    try {
      await deleteStudySession(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setToastMessage("Session log removed.");
      setTimeout(() => setToastMessage(""), 3000);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  // Stats
  const stats = calculateSessionStats(sessions);

  // SVG Progress calculation
  const totalSeconds = targetMinutes * 60;
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;
  const strokeDashoffset = 565 - (565 * progressPercent) / 100;

  // Format time MM:SS
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] md:rounded-[36px] p-6 md:p-8 border border-slate-200 dark:border-slate-700 shadow-xl space-y-6 relative overflow-hidden">
      {/* Background glow styling */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 dark:bg-[#FCB824]/5 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-[var(--teal)] dark:text-[#FCB824]">
            <span className="material-symbols-outlined text-2xl">timer</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold tracking-tight text-[#00243B] dark:text-white">
                {t("Pomodoro Study Timer")}
              </h3>
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-700 dark:text-[#FCB824] bg-teal-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-teal-200 dark:border-[#FCB824]/30">
                Database Sync
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t("Track active revision sessions and log focus intervals directly to Firestore")}
            </p>
          </div>
        </div>

        {/* Quick Stats Pill & Drawer Toggle */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="hidden md:flex items-center gap-3 bg-slate-50 dark:bg-slate-800 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Today's Focus:</span>
            <span className="font-extrabold text-[var(--teal)] dark:text-[#FCB824]">
              {stats.todayFocusMinutes} {t("mins")}
            </span>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {stats.todaySessionsCount} {t("sessions")}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors cursor-pointer"
            title={soundEnabled ? "Sound Alert On" : "Muted"}
          >
            <span className="material-symbols-outlined text-lg">
              {soundEnabled ? "volume_up" : "volume_off"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
            className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#00243B] dark:text-white font-bold text-xs rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">history</span>
            <span>{t("Session Logs")} ({sessions.length})</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 bg-teal-500 text-white rounded-xl text-xs font-bold text-center shadow-md flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Timer Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Controls & Preset Selectors */}
        <div className="lg:col-span-5 space-y-5">
          {/* Preset Mode Tabs */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {t("Session Mode")}
            </label>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
              {(Object.keys(MODE_PRESETS) as TimerMode[]).map((m) => {
                const isSelected = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleModeSelect(m)}
                    className={`py-2 px-2 text-xs font-bold rounded-xl transition-all cursor-pointer text-center ${
                      isSelected
                        ? "bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white shadow-sm border border-slate-200 dark:border-slate-600"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {MODE_PRESETS[m].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject & Task Selection */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t("Target Subject")}
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBJECTS.map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      selectedSubject === sub
                        ? "bg-[var(--teal)] text-white border-[var(--teal)] shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                {t("Session Goal / Topic Title")}
              </label>
              <input
                type="text"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Mechanics & Rotational Dynamics"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
              />
            </div>

            {/* Duration Presets Pills */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                {t("Duration Presets")}
              </label>
              <div className="flex items-center gap-2">
                {[15, 25, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleCustomMinutesChange(mins)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      targetMinutes === mins
                        ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Center Circular Progress Clock Display */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center space-y-6">
          <div className="relative w-64 h-64 md:w-72 md:h-72 flex items-center justify-center">
            {/* SVG Ring */}
            <svg className="w-full h-full -rotate-90">
              <circle
                className="text-slate-200 dark:text-slate-800 stroke-current"
                cx="50%"
                cy="50%"
                fill="transparent"
                r="90"
                strokeWidth="10"
              />
              <circle
                className="transition-all duration-1000 stroke-current"
                cx="50%"
                cy="50%"
                fill="transparent"
                r="90"
                strokeWidth="10"
                stroke={MODE_PRESETS[mode].color}
                strokeDasharray="565"
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
              />
            </svg>

            {/* Central Clock Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
              <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border mb-2 ${MODE_PRESETS[mode].bg}`}>
                {isRunning ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-current animate-ping"></span>
                    {MODE_PRESETS[mode].label} Active
                  </span>
                ) : secondsLeft < totalSeconds ? (
                  "Paused"
                ) : (
                  MODE_PRESETS[mode].label
                )}
              </span>

              <span className="text-4xl md:text-5xl font-extrabold tracking-tight font-mono text-[#00243B] dark:text-white my-1">
                {formatTime(secondsLeft)}
              </span>

              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 max-w-[180px] truncate">
                {selectedSubject}: {taskTitle}
              </span>
            </div>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={toggleTimer}
              className={`px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2 cursor-pointer ${
                isRunning
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-teal-700 dark:hover:bg-amber-400 text-white dark:text-[#00243B]"
              }`}
            >
              <span className="material-symbols-outlined text-lg">
                {isRunning ? "pause" : "play_arrow"}
              </span>
              <span>{isRunning ? "Pause" : secondsLeft < totalSeconds ? "Resume" : "Start Session"}</span>
            </button>

            <button
              type="button"
              onClick={addFiveMinutes}
              className="px-4 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[#00243B] dark:text-white font-bold text-xs rounded-2xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
              title="Add 5 Minutes"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>+5m</span>
            </button>

            <button
              type="button"
              onClick={resetTimer}
              className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              title="Reset Timer"
            >
              <span className="material-symbols-outlined text-lg">replay</span>
            </button>

            <button
              type="button"
              onClick={handleFinishEarly}
              className="px-4 py-3.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-bold text-xs rounded-2xl border border-emerald-200 dark:border-emerald-800 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">check_circle</span>
              <span>Finish & Log</span>
            </button>
          </div>
        </div>
      </div>

      {/* History & Database Logs Drawer */}
      <AnimatePresence>
        {showHistoryDrawer && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-200 dark:border-slate-700 pt-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824]">
                  database
                </span>
                <h4 className="text-sm font-bold text-[#00243B] dark:text-white">
                  Logged Study Sessions (Firestore & Local DB)
                </h4>
              </div>
              <span className="text-xs text-slate-500 font-medium">
                Total Focus: <strong className="text-[var(--teal)] dark:text-[#FCB824]">{stats.totalFocusMinutes} mins</strong>
              </span>
            </div>

            {isLoadingHistory ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading session logs...</div>
            ) : sessions.length === 0 ? (
              <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  No active study sessions logged yet.
                </p>
                <p className="text-[11px] text-slate-400">
                  Complete a Pomodoro timer session or click "Finish & Log" to record your study time to the database.
                </p>
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2.5 pr-1">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/70 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-2.5 py-1 bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 font-bold rounded-lg text-[10px] uppercase">
                        {sess.subject}
                      </span>
                      <div>
                        <h5 className="font-bold text-[#00243B] dark:text-white">
                          {sess.taskTitle}
                        </h5>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {new Date(sess.completedAt).toLocaleDateString()} at {new Date(sess.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {sess.notes && ` • "${sess.notes}"`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="font-extrabold text-[#00243B] dark:text-white block">
                          {sess.durationMinutes} mins
                        </span>
                        <div className="flex items-center text-amber-400 text-[10px]">
                          {"★".repeat(sess.rating || 5)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSession(sess.id)}
                        className="text-slate-400 hover:text-red-500 p-1.5 transition-colors cursor-pointer"
                        title="Delete session log"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Completion Rating / Logging Modal */}
      <AnimatePresence>
        {showLogModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white max-w-md w-full p-6 md:p-8 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-2xl space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto text-3xl">
                  <span className="material-symbols-outlined text-3xl">workspace_premium</span>
                </div>
                <h3 className="text-2xl font-bold tracking-tight">
                  Session Complete!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Great job staying focused! Log this study session to your database scorecard.
                </p>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subject:</span>
                    <span className="font-bold text-[var(--teal)] dark:text-[#FCB824]">{selectedSubject}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Topic:</span>
                    <span className="font-bold text-[#00243B] dark:text-white">{taskTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Duration:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{loggedDuration} minutes</span>
                  </div>
                </div>

                {/* Star Rating */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 text-center">
                    Focus Quality Rating
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className={`text-2xl transition-transform hover:scale-125 cursor-pointer ${
                          star <= rating ? "text-amber-400" : "text-slate-300 dark:text-slate-600"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Reflection / Key Notes (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Mastered friction formulas & solved 15 NTA PYQs"
                    className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs text-[#00243B] dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--teal)]"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Discard
                </button>
                <button
                  type="button"
                  onClick={handleSaveLog}
                  disabled={isSaving}
                  className="flex-1 py-3 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-teal-700 dark:hover:bg-amber-400 text-white dark:text-[#00243B] font-bold text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? "Logging..." : "Log to Database →"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
