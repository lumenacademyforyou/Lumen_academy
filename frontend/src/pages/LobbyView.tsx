import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";

interface LobbyViewProps {
  onStartTest: () => void;
  testTitle: string;
  testCode: string;
  mode: "standard" | "practice";
}

const COUNTDOWN_SECONDS = 30;

export default function LobbyView({ onStartTest, testTitle, testCode, mode }: LobbyViewProps) {
  const { t, language } = useLanguage();

  // P0-2: the countdown itself is a one-shot, per-session event — if this
  // view ever remounts after it already ran (e.g. a mid-flow refresh that
  // lands back here rather than straight into test_taking), it must not
  // restart the countdown and re-delay entry. Keyed by testCode so a
  // different test's lobby isn't affected by a prior one's consumed flag.
  const storageKey = `lumen_lobby_countdown_consumed_${testCode}`;
  const [alreadyConsumed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  // "consent" = checkbox gate, not yet ticking. "countdown" = ticking down,
  // navigates automatically at zero. Per P0-2 the checkbox must be checked
  // BEFORE the countdown starts, not just before a button unlocks at the end.
  const [phase, setPhase] = useState<"consent" | "countdown">("consent");
  const [timeLeft, setTimeLeft] = useState(COUNTDOWN_SECONDS);
  const [agreed, setAgreed] = useState(false);
  const [checkboxError, setCheckboxError] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  // Guards double-navigation: the timeLeft-hits-zero effect and a stray
  // re-render/back-button re-entry must never both call onStartTest().
  const hasNavigatedRef = useRef(false);

  const totalOffset = 552.92; // 2 * PI * 88 for circular progress ring
  const strokeDashoffset = totalOffset - (timeLeft / COUNTDOWN_SECONDS) * totalOffset;

  const navigateIntoTest = () => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {
      // sessionStorage unavailable — worst case the countdown could repeat
      // on a later remount, which is still safe, just not ideal.
    }
    onStartTest();
  };

  // Already consumed on an earlier mount this session — skip straight in,
  // no re-shown checkbox, no replayed countdown.
  useEffect(() => {
    if (alreadyConsumed) navigateIntoTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alreadyConsumed]);

  // Countdown ticks only once the consent gate has been passed.
  useEffect(() => {
    if (phase !== "countdown") return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase]);

  // Reaching zero navigates automatically — no extra click required.
  useEffect(() => {
    if (phase === "countdown" && timeLeft === 0) navigateIntoTest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  // Sophisticated ambient mouse position relative tracking
  const handleMouseMove = (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    // Calculate movement offset for depth perspective
    const moveX = (clientX - window.innerWidth / 2) / 30;
    const moveY = (clientY - window.innerHeight / 2) / 30;
    setMousePos({ x: moveX, y: moveY });
  };

  const handleContinue = () => {
    if (!agreed) {
      setCheckboxError(true);
      return;
    }
    setCheckboxError(false);
    setPhase("countdown");
  };

  if (alreadyConsumed) {
    // Brief, silent bridge frame while onStartTest's screen swap lands —
    // avoids flashing the full consent/countdown UI for a session that
    // already passed through it.
    return (
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
        <span className="text-sm font-semibold text-on-surface-variant">Resuming your test…</span>
      </div>
    );
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-[calc(100vh-200px)] flex flex-col items-center justify-center px-4 md:px-12 py-10 overflow-hidden"
    >
      {/* Sophisticated Atmosphere Glow Layer */}
      <div
        className="absolute top-1/2 left-1/2 w-[600px] h-[600px] md:w-[900px] md:h-[900px] bg-secondary-container/10 rounded-full blur-[140px] -z-10 pointer-events-none transition-transform duration-700 ease-out"
        style={{
          transform: `translate(calc(-50% + ${mousePos.x}px), calc(-50% + ${mousePos.y}px))`
        }}
      ></div>

      <div className="w-full max-w-5xl flex flex-col items-center gap-10">

        {/* Countdown Timer Module */}
        <div className="flex flex-col items-center">
          <div className={`relative w-52 h-52 md:w-60 md:h-60 flex items-center justify-center ${phase === "countdown" ? "animate-pulse-subtle" : ""}`}>
            <div className="absolute inset-0">
              <svg className="w-full h-full" viewBox="0 0 192 192">
                <circle
                  className="text-surface-container-highest"
                  cx="96"
                  cy="96"
                  fill="none"
                  r="88"
                  stroke="currentColor"
                  strokeWidth="7"
                ></circle>
                <circle
                  className="transition-all duration-1000 ease-linear"
                  cx="96"
                  cy="96"
                  fill="none"
                  r="88"
                  stroke="url(#lobbyTimerGradient)"
                  strokeDasharray={totalOffset}
                  strokeDashoffset={phase === "countdown" ? strokeDashoffset : 0}
                  strokeLinecap="round"
                  strokeWidth="7"
                  transform="rotate(-90 96 96)"
                ></circle>
                <defs>
                  <linearGradient id="lobbyTimerGradient" x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" style={{ stopColor: "#b45309" }}></stop>
                    <stop offset="100%" style={{ stopColor: "#0f172a" }}></stop>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl md:text-6xl font-extrabold text-primary font-sans leading-none">
                {phase === "countdown" ? timeLeft : COUNTDOWN_SECONDS}
              </span>
              <span className="font-sans font-bold text-[10px] md:text-xs text-outline uppercase tracking-[0.2em] mt-1.5">
                {phase === "countdown" ? "Seconds" : "Ready"}
              </span>
            </div>
          </div>

          <p className="mt-6 text-xl md:text-2xl font-bold text-on-surface-variant text-center">
            {phase === "countdown" ? "Your test is about to begin" : "Review the instructions below to begin"}
          </p>
          <p className="text-secondary font-semibold text-sm mt-1">{testTitle}</p>
          <p className="text-outline font-mono text-xs mt-1">{testCode}</p>
        </div>

        {/* Instructions Bento Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full">

          {/* Rules Card */}
          <div className="lg:col-span-7 bg-surface-container-lowest border border-outline-variant rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-sm hover:shadow-xl transition-all duration-500">
            <div className="flex items-center gap-3.5 mb-6 md:mb-8">
              <span className="material-symbols-outlined text-secondary text-3xl md:text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                gavel
              </span>
              <h2 className="text-xl md:text-2xl font-bold text-primary font-sans">{t("Test Rules")}</h2>
            </div>

            <ul className="space-y-6 md:space-y-8">
              <li className="flex gap-3.5">
                <span className="material-symbols-outlined text-secondary text-xl md:text-2xl mt-1">visibility</span>
                <div className="flex flex-col">
                  <span className="font-bold text-base md:text-lg text-on-surface">{t("Standard Examination Session")}</span>
                  <span className="text-xs md:text-sm text-on-surface-variant mt-0.5 leading-relaxed">
                    This is a standardized NEET mock examination session under Lumen Academy test guidelines.
                  </span>
                </div>
              </li>

              <li className="flex gap-3.5">
                <span className="material-symbols-outlined text-outline text-xl md:text-2xl mt-1">history</span>
                <div className="flex flex-col">
                  <span className="font-bold text-base md:text-lg text-on-surface">{t("Auto-Submission")}</span>
                  <span className="text-xs md:text-sm text-on-surface-variant mt-0.5 leading-relaxed">
                    The test environment automatically submits when the countdown timer reaches zero.
                  </span>
                </div>
              </li>
            </ul>
          </div>

          {/* Scoring Matrix Panel */}
          <div className="lg:col-span-5 bg-surface-container-lowest border border-outline-variant rounded-[24px] md:rounded-[32px] p-6 md:p-8 shadow-sm hover:shadow-xl transition-all duration-500 flex flex-col justify-between">
            <div className="flex items-center gap-3.5 mb-6 md:mb-8">
              <span className="material-symbols-outlined text-secondary text-3xl md:text-4xl">analytics</span>
              <h2 className="text-xl md:text-2xl font-bold text-primary font-sans">{t("Scoring Matrix")}</h2>
            </div>

            <div className="space-y-3 flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-center p-4 bg-secondary-container/10 rounded-2xl hover:bg-secondary-container/20 transition-colors border border-secondary/10">
                <span className="text-xs md:text-sm font-semibold text-on-surface">{t("Correct Response")}</span>
                <span className="text-2xl md:text-3xl font-extrabold text-secondary">+4</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-error-container/10 rounded-2xl hover:bg-error-container/20 transition-colors border border-error/10">
                <span className="text-xs md:text-sm font-semibold text-on-surface">{t("Incorrect Response")}</span>
                <span className="text-2xl md:text-3xl font-extrabold text-error">-1</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container-high transition-colors border border-outline-variant/10">
                <span className="text-xs md:text-sm font-semibold text-on-surface">{t("Unattempted")}</span>
                <span className="text-2xl md:text-3xl font-extrabold text-outline">0</span>
              </div>
            </div>
          </div>
        </div>

        {/* Confirmation agreement check & trigger */}
        {phase === "consent" ? (
          <div className="flex flex-col items-center mt-4 w-full">
            <label
              className={`flex items-center gap-3.5 cursor-pointer mb-3 group bg-surface-container-low/40 px-6 py-3.5 rounded-full border transition-all max-w-full text-center ${
                checkboxError ? "border-error ring-2 ring-error/40 animate-pulse" : "border-transparent hover:border-outline-variant"
              }`}
            >
              <div className="relative">
                <input
                  type="checkbox"
                  id="terms"
                  checked={agreed}
                  onChange={(e) => {
                    setAgreed(e.target.checked);
                    if (e.target.checked) setCheckboxError(false);
                  }}
                  className="peer hidden"
                />
                <div className={`w-6.5 h-6.5 border-2 rounded-lg peer-checked:bg-secondary peer-checked:border-secondary transition-all flex items-center justify-center ${checkboxError ? "border-error" : "border-outline"}`}>
                  <span className="material-symbols-outlined text-white text-base font-bold opacity-0 peer-checked:opacity-100 transition-opacity">
                    check
                  </span>
                </div>
              </div>
              <span className="text-xs md:text-sm font-medium text-on-surface-variant group-hover:text-primary transition-colors select-none">
                I have read and understand all the instructions provided above.
              </span>
            </label>

            {checkboxError && (
              <p role="alert" className="text-xs md:text-sm font-bold text-error mb-5 text-center">
                Please tick the checkbox to enter the test.
              </p>
            )}

            <button
              onClick={handleContinue}
              className="group relative overflow-hidden px-12 md:px-16 py-4 md:py-5 bg-gradient-to-r from-primary to-secondary text-white rounded-[20px] md:rounded-[24px] font-sans font-bold text-lg md:text-xl shadow-xl hover:shadow-2xl hover:scale-[1.03] active:scale-95 transition-all duration-300"
            >
              {/* Ambient Shimmer Overlay */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-full">
                <div className="w-1/2 h-full bg-white/20 blur-xl animate-shimmer absolute top-0 left-0"></div>
              </div>
              <span className="relative z-10 flex items-center justify-center gap-3.5">
                <span className="material-symbols-outlined text-lg md:text-xl">play_circle</span>
                I Understand, Start Test
              </span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center mt-4 w-full gap-2">
            <span className="text-xs md:text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              Entering the test automatically when the timer ends…
            </span>
          </div>
        )}

      </div>
    </div>
  );
}
