import React, { useEffect, useRef } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import type { AvailabilityResult, ShortfallReason } from "../../types";

/**
 * The blocking "Not enough questions" dialog — docs/test-engine-fix-prompt.md
 * Defect 6.
 *
 * The hard rule this component exists to enforce: **a short test never starts
 * without an explicit tap.** Either the student presses "Build with N" and
 * accepts the reduced count, or nothing starts. There is no path around it —
 * TestListView runs the availability check as a final blocking gate on Start
 * even when the debounced check already ran, because the pool can change
 * between screens.
 *
 * Built as its own component rather than through the shared Modal because the
 * accessibility contract here is different from every other modal in this app:
 * `role="alertdialog"` (not `dialog`), focus trapped inside, and focus
 * returned to the Start button on close. Modal hardcodes `role="dialog"` and
 * traps nothing.
 *
 * Full-mock mode is stricter, per the spec: a blueprint cannot be silently
 * reduced, so "Build with N" is withheld entirely and only "Change settings"
 * and "Cancel" are offered.
 */

const REASON_TEXT: Record<ShortfallReason, string> = {
  POOL_TOO_SMALL: "",
  FILTERED_OUT_BY_DIFFICULTY: "no questions at the selected difficulty",
  EXCLUDED_RECENTLY_ATTEMPTED: "remaining questions were attempted recently",
  NO_VALID_IMAGE: "no questions with a usable image",
  UNIT_NOT_PUBLISHED: "unit not available yet",
};

interface Props {
  availability: AvailabilityResult;
  /** Full mock cannot be reduced — its blueprint is the test. */
  allowReducedBuild: boolean;
  /** "Build with N" — rewrites the config to the available count and starts. */
  onBuildWithAvailable: () => void;
  /** "Change settings" — back to the config screen with the banner still up. */
  onChangeSettings: () => void;
  /** "Cancel" — closes, changes nothing. */
  onCancel: () => void;
  /** Focus returns here on close, per the spec. */
  returnFocusTo: React.RefObject<HTMLElement | null>;
}

export default function InsufficientQuestionsDialog({
  availability,
  allowReducedBuild,
  onBuildWithAvailable,
  onChangeSettings,
  onCancel,
  returnFocusTo,
}: Props) {
  const { t } = useLanguage();
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  const canBuild = allowReducedBuild && availability.available > 0;

  // Focus the primary action on open; hand focus back to Start on unmount.
  useEffect(() => {
    firstActionRef.current?.focus();
    const previous = returnFocusTo.current;
    return () => {
      previous?.focus();
    };
  }, [returnFocusTo]);

  // Trap Tab inside the dialog, and treat Escape as Cancel.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#00243B]/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="insufficient-questions-title"
        aria-describedby="insufficient-questions-body"
        className="w-full max-w-md bg-white dark:bg-[var(--navy)] rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-2xl p-6 md:p-7"
      >
        <div className="flex items-start gap-3 mb-3">
          <span className="material-symbols-outlined text-amber-500 text-2xl">warning</span>
          <h3 id="insufficient-questions-title" className="text-lg font-bold text-[#00243B] dark:text-white">
            {t("Not enough questions")}
          </h3>
        </div>

        <div id="insufficient-questions-body" className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
          {availability.available > 0 ? (
            <p>
              {t("You asked for")} {availability.requested} {t("questions.")} {t("Only")} {availability.available} {t("are available with these settings.")}
            </p>
          ) : (
            <p className="font-semibold">{t("No questions match these settings. Try removing a filter or selecting more units.")}</p>
          )}

          {!allowReducedBuild && availability.available > 0 && (
            // The admin-visible alert the spec asks for is logged server-side
            // by the availability endpoint's own caller; this is the student-
            // facing half of the same fact.
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              {t("A Full Mock Test follows the official blueprint and cannot be shortened. Try again once more questions are published.")}
            </p>
          )}

          {availability.byUnit.length > 0 && (
            <ul className="pt-1 space-y-1">
              {availability.byUnit.map((row, i) => (
                <li key={`${row.unitId ?? "subject"}-${i}`} className="text-xs font-medium">
                  {row.unitName} — {row.available} {t("of")} {row.requested} {t("available")}
                  {REASON_TEXT[row.reason] ? ` (${t(REASON_TEXT[row.reason])})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-2 mt-6">
          {canBuild && (
            <button
              ref={firstActionRef}
              type="button"
              onClick={onBuildWithAvailable}
              className="w-full py-3 font-bold text-xs uppercase tracking-wider rounded-xl bg-[var(--teal)] dark:bg-[#FCB824] text-white hover:bg-[var(--teal-2)] shadow-md transition-all cursor-pointer"
            >
              {t("Build with")} {availability.available}
            </button>
          )}
          <button
            ref={canBuild ? undefined : firstActionRef}
            type="button"
            onClick={onChangeSettings}
            className="w-full py-3 font-bold text-xs uppercase tracking-wider rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            {t("Change settings")}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="w-full py-2.5 font-bold text-xs uppercase tracking-wider rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            {t("Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
