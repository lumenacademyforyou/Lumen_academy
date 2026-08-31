import React, { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import type { AvailabilityResult, ShortfallReason } from "../../types";

/**
 * "Not enough questions for this test" — the inline, persistent banner from
 * docs/test-engine-fix-prompt.md Defect 6.
 *
 * Deliberately not a toast. The spec is explicit about why, and it is right:
 * an auto-dismissing toast is exactly the thing a student misses right before
 * they press Start. This sits in the config screen's flow and stays until the
 * config actually stops being short.
 *
 * Collapsed to one line by default, expandable to the per-unit breakdown.
 * `role="status"` + `aria-live="polite"` so a screen reader announces the new
 * count when a filter changes without interrupting the student mid-keystroke.
 *
 * Renders nothing at all unless the result it was handed describes the config
 * currently on screen (`configHash` match) — Defect 4's scoping rule enforced
 * at the last possible moment, so a stale warning can never be painted even
 * if a caller forgets to clear its own state.
 */

const REASON_TEXT: Record<ShortfallReason, string> = {
  // The "6 of 15" line already says it — the spec asks for no extra text here.
  POOL_TOO_SMALL: "",
  FILTERED_OUT_BY_DIFFICULTY: "no questions at the selected difficulty",
  EXCLUDED_RECENTLY_ATTEMPTED: "remaining questions were attempted recently",
  NO_VALID_IMAGE: "no questions with a usable image",
  UNIT_NOT_PUBLISHED: "unit not available yet",
};

interface Props {
  availability: AvailabilityResult | null;
  /** Hash of the configuration currently on screen. */
  currentConfigHash: string | null;
}

export default function QuestionAvailabilityBanner({ availability, currentConfigHash }: Props) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  // Any mismatch renders nothing — never a stale unit chip from another test.
  if (!availability || availability.shortfall <= 0) return null;
  if (currentConfigHash !== null && availability.configHash !== currentConfigHash) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="px-4 py-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200"
    >
      <p className="text-sm font-bold flex items-center gap-2">
        <span className="material-symbols-outlined text-lg">warning</span>
        {t("Not enough questions for this test")}
      </p>
      <p className="text-xs font-medium mt-1">
        {t("You asked for")} {availability.requested} {t("questions.")} {t("Only")} {availability.available} {t("are available with these settings.")}
      </p>
      {availability.byUnit.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="mt-2 text-xs font-bold italic underline underline-offset-2 hover:opacity-80 cursor-pointer"
          >
            {expanded ? t("Hide details") : t("Show details")}
          </button>
          {expanded && (
            <ul className="mt-2 space-y-1">
              {availability.byUnit.map((row, i) => (
                <li key={`${row.unitId ?? "subject"}-${i}`} className="text-xs font-medium">
                  {row.unitName} — {row.available} {t("of")} {row.requested} {t("available")}
                  {REASON_TEXT[row.reason] ? ` (${t(REASON_TEXT[row.reason])})` : ""}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
