import React, { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { StudentProfile } from "../../supabase";

interface NotificationBellProps {
  profile: StudentProfile | null;
}

// Fields we consider "required" for a complete profile.
// label = shown to the user, key = field on StudentProfile
const REQUIRED_FIELDS: { key: keyof StudentProfile; label: string }[] = [
  { key: "display_name", label: "Name" },
  { key: "phone_number", label: "Mobile Number" },
  { key: "target_stream", label: "Target Stream" },
  { key: "grade_class", label: "Class / Grade" },
  { key: "school_or_coaching", label: "School / Coaching Institute" },
  { key: "city", label: "City" },
];

function getMissingFields(profile: StudentProfile | null): string[] {
  if (!profile) return REQUIRED_FIELDS.map((f) => f.label);

  return REQUIRED_FIELDS.filter((field) => {
    const value = profile[field.key];
    return !value || (typeof value === "string" && !value.trim());
  }).map((f) => f.label);
}

export default function NotificationBell({ profile }: NotificationBellProps) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  const missingFields = getMissingFields(profile);
  const hasIncompleteProfile = missingFields.length > 0;

  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative cursor-pointer flex items-center justify-center"
        title="Notifications"
      >
        <span className="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[24px]">
          notifications
        </span>
        {hasIncompleteProfile && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-[var(--navy)]"></span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
            <h4 className="font-bold text-sm text-[#00243B] dark:text-white mb-3 flex justify-between items-center">
              <span>{t("Notifications")}</span>
              <span
                className="text-xs text-[var(--teal)] dark:text-[#FCB824] font-semibold cursor-pointer hover:underline"
                onClick={() => setIsOpen(false)}
              >
                Close
              </span>
            </h4>

            {hasIncompleteProfile ? (
              <div
                onClick={() => {
                  navigate("/profile");
                  setIsOpen(false);
                }}
                className="p-2.5 hover:bg-slate-50 dark:hover:bg-[var(--navy)] rounded-xl text-xs transition-colors border-l-2 border-[#FCB824] cursor-pointer"
              >
                <p className="font-semibold text-[#00243B] dark:text-white">
                  {t("Complete Your Profile")}
                </p>
                <p className="text-slate-500 dark:text-slate-400 mt-0.5">
                  {t("Missing")}: {missingFields.join(", ")}
                </p>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-slate-300 dark:text-slate-600 text-[28px] mb-1.5">
                  notifications_off
                </span>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t("You're all caught up")}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}