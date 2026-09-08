import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPomodoroSession } from "../../../services/pomodoroApi";

/**
 * LA-UX-REFRESH-001 F9 — "a focus mode in the hero panel exactly like in the
 * LeetCode website."
 *
 * LeetCode's focus mode does one thing: it takes everything that is not the
 * work away. That is the whole idea reproduced here — the app's chrome, nav,
 * cards, notifications and streak badges all disappear behind a full-screen
 * surface carrying only the clock, what you said you were working on, and the
 * way out. Esc exits, exactly as it does there.
 *
 * A completed stretch is written through the same pomodoro-session API the
 * dashboard timer already uses, so time spent here counts toward the study
 * streak instead of being a decorative timer that records nothing.
 */

interface FocusModeProps {
  open: boolean;
  onClose: () => void;
  /** The student's saved daily target, used to preselect a sensible length. */
  defaultMinutes?: number | null;
}

const DURATION_CHOICES = [25, 30, 45, 60, 90];
const SUBJECT_CHOICES = ["Physics", "Chemistry", "Botany", "Zoology", "General Study"];

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
  return DURATION_CHOICES.reduce((best, choice) =>
    Math.abs(choice - target) < Math.abs(best - target) ? choice : best
  );
}

export default function FocusMode({ open, onClose, defaultMinutes }: FocusModeProps) {
  const [targetMinutes, setTargetMinutes] = useState(() => pickDefaultDuration(defaultMinutes));
  const [secondsLeft, setSecondsLeft] = useState(() => pickDefaultDuration(defaultMinutes) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [subject, setSubject] = useState(SUBJECT_CHOICES[0]);
  const [taskTitle, setTaskTitle] = useState("");
  const [finished, setFinished] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  const containerRef = useRef<HTMLDivElement | null>(null);
  // Wall-clock start, kept in a ref: the elapsed time that gets logged must
  // be real time, not a count of setInterval ticks — a backgrounded tab
  // throttles those, and the student did not stop studying because Chrome
  // deprioritised the timer.
  const startedAtRef = useRef<string | null>(null);
  const startedMsRef = useRef<number | null>(null);

  const elapsedSeconds = useCallback((): number => {
    if (startedMsRef.current === null) return 0;
    return Math.max(0, Math.round((Date.now() - startedMsRef.current) / 1000));
  }, []);

  // Reset to a clean slate every time the overlay opens.
  useEffect(() => {
    if (!open) return;
    const initial = pickDefaultDuration(defaultMinutes);
    setTargetMinutes(initial);
    setSecondsLeft(initial * 60);
    setIsRunning(false);
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

  const exitFullscreen = useCallback(() => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        /* the browser may refuse; the overlay closes either way */
      });
    }
  }, []);

  const handleClose = useCallback(async () => {
    if (startedMsRef.current !== null && saveState === "idle") {
      await saveSession();
    }
    exitFullscreen();
    onClose();
  }, [saveSession, saveState, exitFullscreen, onClose]);

  // Esc exits, as it does on LeetCode. Bound while open only.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void handleClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  // Nothing behind the overlay should scroll while it is up.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Log the session when the countdown reaches zero on its own.
  useEffect(() => {
    if (finished && saveState === "idle") void saveSession();
  }, [finished, saveState, saveSession]);

  const handleStart = () => {
    if (startedMsRef.current === null) {
      startedAtRef.current = new Date().toISOString();
      startedMsRef.current = Date.now();
    }
    setIsRunning(true);
    // Real fullscreen if the browser allows it — a request outside a user
    // gesture, or with the feature disabled, simply rejects, and the overlay
    // is already visually full-screen regardless.
    containerRef.current?.requestFullscreen?.().catch(() => {
      /* not fatal */
    });
  };

  if (!open) return null;

  const totalSeconds = targetMinutes * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;
  const hasStarted = startedMsRef.current !== null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="Focus mode"
      className="fixed inset-0 z-[100] bg-[#06121c] text-white flex flex-col items-center justify-center px-6 py-10 select-none"
    >
      {/* Exit — the only chrome on the surface. */}
      <button
        onClick={() => void handleClose()}
        className="absolute top-5 right-5 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer"
        title="Exit focus mode (Esc)"
      >
        <span className="material-symbols-outlined text-[16px]">close_fullscreen</span>
        Exit
      </button>

      <div className="w-full max-w-lg flex flex-col items-center gap-8">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#FCB824]">Focus Mode</p>

        {/* Clock */}
        <div className="relative flex items-center justify-center">
          <svg className="w-64 h-64 md:w-72 md:h-72 -rotate-90" viewBox="0 0 240 240">
            <circle cx="120" cy="120" r="108" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="120"
              cy="120"
              r="108"
              fill="none"
              stroke="#FCB824"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 108}
              strokeDashoffset={2 * Math.PI * 108 * (1 - progress / 100)}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-5xl md:text-6xl font-black tabular-nums tracking-tight">{formatClock(secondsLeft)}</span>
            <span className="mt-2 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">
              {finished ? "Session complete" : isRunning ? "Stay with it" : "Ready when you are"}
            </span>
          </div>
        </div>

        {/* Setup — hidden once the clock is running, because it is exactly the
            kind of thing focus mode exists to get out of the way. */}
        {!hasStarted && (
          <div className="w-full space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {DURATION_CHOICES.map((minutes) => (
                <button
                  key={minutes}
                  onClick={() => {
                    setTargetMinutes(minutes);
                    setSecondsLeft(minutes * 60);
                  }}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer ${
                    targetMinutes === minutes
                      ? "bg-[#FCB824] text-[#00243B] border-transparent"
                      : "bg-white/5 text-slate-300 border-white/10 hover:border-[#FCB824]/60"
                  }`}
                >
                  {minutes} min
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white outline-none focus:border-[#FCB824] sm:w-44"
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
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white placeholder:text-slate-500 outline-none focus:border-[#FCB824]"
              />
            </div>
          </div>
        )}

        {hasStarted && (taskTitle.trim() || subject) && (
          <p className="text-sm font-semibold text-slate-300 text-center">
            {subject}
            {taskTitle.trim() ? ` • ${taskTitle.trim()}` : ""}
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3">
          {!finished && (
            <button
              onClick={() => (isRunning ? setIsRunning(false) : handleStart())}
              className="px-8 py-3.5 rounded-2xl bg-[#FCB824] text-[#00243B] font-black text-xs uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              {isRunning ? "Pause" : hasStarted ? "Resume" : "Start"}
            </button>
          )}
          <button
            onClick={() => void handleClose()}
            className="px-6 py-3.5 rounded-2xl border border-white/15 text-slate-300 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-colors cursor-pointer"
          >
            {finished ? "Done" : "End session"}
          </button>
        </div>

        {saveState !== "idle" && (
          <p className="text-[11px] font-semibold text-slate-400">
            {saveState === "saving" && "Logging this session…"}
            {saveState === "saved" && "Session logged — it counts toward your study streak."}
            {saveState === "failed" && "Couldn't log this session, but your time still counted."}
          </p>
        )}

        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Press Esc to exit</p>
      </div>
    </div>
  );
}
