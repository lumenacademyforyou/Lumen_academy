import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPomodoroSession } from "../../../services/pomodoroApi";

/**
 * LA-UX-REFRESH-002 G2 — Focus Mode, rebuilt.
 *
 * The first version (LA-UX-REFRESH-001 F9) was a full-screen takeover with a
 * large progress dial. The user's verdict was fair: that is a Pomodoro timer
 * wearing a different name, and worse, it locked page scrolling — so you
 * could not actually study *in the app* while it ran.
 *
 * This version is a compact, notification-shaped panel pinned to a corner:
 *   - no backdrop and no body-scroll lock, so the app stays fully live and
 *     scrollable behind it (the "add scrolling feature" ask),
 *   - fixed presets AND a manual minutes entry, side by side,
 *   - collapses to a small pill showing just the remaining time, so it can
 *     sit there for a whole session without being in the way,
 *   - scrolls internally when the viewport is too short for the panel.
 *
 * Completed stretches still log through the same pomodoro-session API, so
 * time spent here counts toward the study streak rather than evaporating.
 */

interface FocusModeProps {
  open: boolean;
  onClose: () => void;
  /** The student's saved daily target, used to preselect a sensible length. */
  defaultMinutes?: number | null;
}

const DURATION_CHOICES = [25, 30, 45, 60, 90];
const SUBJECT_CHOICES = ["Physics", "Chemistry", "Botany", "Zoology", "General Study"];
const MAX_MANUAL_MINUTES = 600;

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Nearest offered length to the student's own daily target, so the default is theirs rather than ours. */
function pickDefaultDuration(target: number | null | undefined): number {
  if (!target) return 25;
  return DURATION_CHOICES.reduce((best, choice) => (Math.abs(choice - target) < Math.abs(best - target) ? choice : best));
}

export default function FocusMode({ open, onClose, defaultMinutes }: FocusModeProps) {
  const [targetMinutes, setTargetMinutes] = useState(() => pickDefaultDuration(defaultMinutes));
  const [manualMinutes, setManualMinutes] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(() => pickDefaultDuration(defaultMinutes) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [subject, setSubject] = useState(SUBJECT_CHOICES[0]);
  const [taskTitle, setTaskTitle] = useState("");
  const [finished, setFinished] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  // Wall-clock start, kept in a ref: the elapsed time that gets logged must be
  // real time, not a count of setInterval ticks — a backgrounded tab throttles
  // those, and the student did not stop studying because Chrome deprioritised
  // the timer.
  const startedAtRef = useRef<string | null>(null);
  const startedMsRef = useRef<number | null>(null);

  const elapsedSeconds = useCallback((): number => {
    if (startedMsRef.current === null) return 0;
    return Math.max(0, Math.round((Date.now() - startedMsRef.current) / 1000));
  }, []);

  // Reset to a clean slate every time the panel opens.
  useEffect(() => {
    if (!open) return;
    const initial = pickDefaultDuration(defaultMinutes);
    setTargetMinutes(initial);
    setManualMinutes("");
    setSecondsLeft(initial * 60);
    setIsRunning(false);
    setCollapsed(false);
    setFinished(false);
    setSaveState("idle");
    startedAtRef.current = null;
    startedMsRef.current = null;
  }, [open, defaultMinutes]);

  // Countdown.
  useEffect(() => {
    if (!open || !isRunning) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, isRunning]);

  const saveSession = useCallback(async () => {
    const seconds = elapsedSeconds();
    // Under a minute is a mis-click, not a study session — logging it would
    // put noise into the streak calculation.
    if (seconds < 60 || !startedAtRef.current) return;
    setSaveState("saving");
    try {
      await createPomodoroSession({
        subject,
        task_title: taskTitle.trim() || "Focus session",
        session_type: "focus",
        started_at: startedAtRef.current,
        duration_seconds: seconds,
      });
      setSaveState("saved");
      // The header and dashboard both recompute the streak on this event —
      // the same signal PomodoroTimer emits after it saves.
      window.dispatchEvent(new Event("lumen_session_saved"));
    } catch (err) {
      console.error("Failed to log focus session:", err);
      setSaveState("failed");
    }
  }, [elapsedSeconds, subject, taskTitle]);

  const handleClose = useCallback(async () => {
    if (startedMsRef.current !== null && saveState === "idle") {
      await saveSession();
    }
    onClose();
  }, [saveSession, saveState, onClose]);

  // Esc closes it. Bound while open only. Note there is deliberately no
  // body-scroll lock and no backdrop: the whole point of this rebuild is that
  // the app stays usable behind the timer.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") void handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  // Log the session when the countdown reaches zero on its own.
  useEffect(() => {
    if (finished && saveState === "idle") void saveSession();
  }, [finished, saveState, saveSession]);

  const applyDuration = (minutes: number) => {
    setTargetMinutes(minutes);
    setSecondsLeft(minutes * 60);
  };

  const handleManualMinutes = (raw: string) => {
    setManualMinutes(raw);
    const parsed = Number(raw);
    if (!raw.trim() || !Number.isFinite(parsed)) return;
    const clamped = Math.min(MAX_MANUAL_MINUTES, Math.max(1, Math.round(parsed)));
    applyDuration(clamped);
  };

  const handleStart = () => {
    if (startedMsRef.current === null) {
      startedAtRef.current = new Date().toISOString();
      startedMsRef.current = Date.now();
    }
    setIsRunning(true);
  };

  if (!open) return null;

  const totalSeconds = targetMinutes * 60;
  const progress = totalSeconds > 0 ? Math.min(100, ((totalSeconds - secondsLeft) / totalSeconds) * 100) : 0;
  const hasStarted = startedMsRef.current !== null;

  // Collapsed: a pill with the clock and nothing else.
  if (collapsed) {
    return (
      <div className="fixed bottom-5 right-5 z-[90] print:hidden">
        <button
          onClick={() => setCollapsed(false)}
          aria-label="Expand focus timer"
          className="flex items-center gap-2 pl-3.5 pr-4 py-2.5 rounded-full bg-[#06121c]/95 text-white border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.35)] backdrop-blur-md hover:border-[#FCB824]/60 transition-colors cursor-pointer"
        >
          <span className={`material-symbols-outlined text-[18px] text-[#FCB824] ${isRunning ? "animate-pulse" : ""}`}>
            center_focus_strong
          </span>
          <span className="text-sm font-black tabular-nums tracking-tight">{formatClock(secondsLeft)}</span>
        </button>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Focus mode"
      // Notification-shaped, corner-pinned, and capped to the viewport with
      // its own overflow — never a full-screen surface, and never taller than
      // the window on a short screen.
      className="fixed bottom-5 right-5 z-[90] w-[min(20rem,calc(100vw-2.5rem))] max-h-[min(32rem,calc(100vh-2.5rem))] overflow-y-auto rounded-3xl bg-[#06121c]/97 text-white border border-white/15 shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-md print:hidden"
    >
      {/* Header strip */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className={`material-symbols-outlined text-[18px] text-[#FCB824] ${isRunning ? "animate-pulse" : ""}`}>
          center_focus_strong
        </span>
        <p className="flex-1 text-[10px] font-black uppercase tracking-[0.22em] text-[#FCB824]">Focus Mode</p>
        <button
          onClick={() => setCollapsed(true)}
          aria-label="Minimise focus timer"
          title="Minimise"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">remove</span>
        </button>
        <button
          onClick={() => void handleClose()}
          aria-label="Close focus mode"
          title="Close (Esc)"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>

      {/* Clock */}
      <div className="px-4">
        <p className="text-4xl font-black tabular-nums tracking-tight leading-none">{formatClock(secondsLeft)}</p>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          {finished ? "Session complete" : isRunning ? "Stay with it" : hasStarted ? "Paused" : "Ready when you are"}
        </p>
        {/* A thin bar, not a dial — this is a notification, not a dashboard. */}
        <div className="mt-3 h-1 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-[#FCB824]"
            style={{ width: `${progress}%`, transition: "width 1s linear" }}
          />
        </div>
      </div>

      {/* Setup — presets and manual entry. Hidden once running, which is
          exactly what focus mode exists to do. */}
      {!hasStarted && (
        <div className="px-4 pt-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {DURATION_CHOICES.map((minutes) => (
              <button
                key={minutes}
                onClick={() => {
                  setManualMinutes("");
                  applyDuration(minutes);
                }}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer ${
                  targetMinutes === minutes && !manualMinutes
                    ? "bg-[#FCB824] text-[#00243B] border-transparent"
                    : "bg-white/5 text-slate-300 border-white/10 hover:border-[#FCB824]/60"
                }`}
              >
                {minutes}m
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={MAX_MANUAL_MINUTES}
              value={manualMinutes}
              onChange={(e) => handleManualMinutes(e.target.value)}
              placeholder="Custom"
              aria-label="Custom duration in minutes"
              className="w-20 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-[11px] font-bold text-white placeholder:text-slate-500 outline-none focus:border-[#FCB824]"
            />
          </div>

          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            aria-label="Subject"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-semibold text-white outline-none focus:border-[#FCB824]"
          >
            {SUBJECT_CHOICES.map((s) => (
              <option key={s} value={s} className="bg-[#06121c]">
                {s}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="What are you working on?"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[11px] font-semibold text-white placeholder:text-slate-500 outline-none focus:border-[#FCB824]"
          />
        </div>
      )}

      {hasStarted && (
        <p className="px-4 pt-3 text-[11px] font-semibold text-slate-300 truncate">
          {subject}
          {taskTitle.trim() ? ` • ${taskTitle.trim()}` : ""}
        </p>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2 px-4 py-4">
        {!finished && (
          <button
            onClick={() => (isRunning ? setIsRunning(false) : handleStart())}
            className="flex-1 py-2.5 rounded-xl bg-[#FCB824] text-[#00243B] font-black text-[11px] uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            {isRunning ? "Pause" : hasStarted ? "Resume" : "Start"}
          </button>
        )}
        <button
          onClick={() => void handleClose()}
          className={`py-2.5 rounded-xl border border-white/15 text-slate-300 font-bold text-[11px] uppercase tracking-widest hover:bg-white/5 transition-colors cursor-pointer ${
            finished ? "flex-1" : "px-4"
          }`}
        >
          {finished ? "Done" : "End"}
        </button>
      </div>

      {saveState !== "idle" && (
        <p className="px-4 pb-4 -mt-2 text-[10px] font-semibold text-slate-400">
          {saveState === "saving" && "Logging this session…"}
          {saveState === "saved" && "Logged — it counts toward your streak."}
          {saveState === "failed" && "Couldn't log this session, but your time still counted."}
        </p>
      )}
    </div>
  );
}
