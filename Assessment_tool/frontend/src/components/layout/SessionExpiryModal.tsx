import type { SessionExpiryReason } from "../../hooks/useIdleSessionGuard";
import Modal from "./Modal";

// LA-APP-COMPLETION-001 Phase H (D10) — now built on the shared Modal.
// Escape/backdrop-click-to-close are both deliberately disabled: this is a
// security-relevant idle/absolute-timeout warning, dismissible only via its
// own two explicit actions (Stay Signed In / Sign Out Now), never by
// accident.
interface SessionExpiryModalProps {
  reason: SessionExpiryReason;
  secondsRemaining: number;
  onStayActive: () => void;
  onSignOutNow: () => void;
}

export default function SessionExpiryModal({ reason, secondsRemaining, onStayActive, onSignOutNow }: SessionExpiryModalProps) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const clock = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return (
    <Modal onClose={onSignOutNow} zIndexClassName="z-[60]" closeOnBackdropClick={false} closeOnEscape={false}>
      <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white w-full max-w-lg rounded-[36px] md:rounded-[48px] p-8 md:p-12 shadow-2xl flex flex-col items-center text-center border border-slate-200 dark:border-slate-700">
        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-6 md:mb-8 bg-amber-100 dark:bg-amber-950/60">
          <span className="material-symbols-outlined text-[40px] md:text-[48px] text-amber-600 dark:text-[#FCB824]" style={{ fontVariationSettings: "'FILL' 1" }}>
            hourglass_top
          </span>
        </div>

        <h2 className="font-sans font-extrabold text-3xl md:text-4xl text-[#00243B] dark:text-white mb-2">Still there?</h2>

        <div className="text-slate-600 dark:text-slate-300 text-sm md:text-base mb-4 leading-relaxed font-sans font-medium">
          <p>
            {reason === "absolute_timeout"
              ? "Your session has reached its maximum length and will end soon."
              : "You've been inactive for a while and will be signed out soon."}
            {" "}Any test in progress will be safely paused and can be resumed after you sign in again.
          </p>
        </div>

        <div className="font-mono text-4xl md:text-5xl font-extrabold text-amber-600 dark:text-[#FCB824] mb-8 md:mb-10 tabular-nums">{clock}</div>

        <div className="w-full space-y-3">
          <button
            onClick={onStayActive}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-bold text-base md:text-lg rounded-2xl shadow-lg transition-all cursor-pointer"
          >
            Stay Signed In
          </button>
          <button
            onClick={onSignOutNow}
            className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-[#00243B] dark:text-white border border-slate-300 dark:border-slate-700 font-bold text-base md:text-lg rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            Sign Out Now
          </button>
        </div>
      </div>
    </Modal>
  );
}
