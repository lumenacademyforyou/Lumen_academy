

import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { motion } from "motion/react";
import {
  fetchAppUser,
  fetchStudentProfile,
  saveStudentProfile,
  StudentProfile,
  AppUser,
  supabase,
} from "../../supabase";

interface ProfileCardProps {
  onProfileChange?: (profile: StudentProfile) => void;
  onIncompleteChange?: (incomplete: boolean) => void;
}

const CLASS_OPTIONS = [
  "11th",
  "12th",
  "Dropper / Repeater",
];

export function ProfileCard({
  onProfileChange,
  onIncompleteChange,
}: ProfileCardProps) {
  const { t } = useLanguage();

  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<
    Partial<StudentProfile>
  >({});

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      // Fetch application user
      const userData = await fetchAppUser(user.id);

      if (!isMounted) return;

      if (userData) {
        setAppUser(userData);
      }

      // Fetch student profile
      const studentProfile = await fetchStudentProfile(user.id);

      if (!isMounted) return;

      if (studentProfile) {
        setProfile(studentProfile);
        setDraft(studentProfile);

        onProfileChange?.(studentProfile);

        const incomplete =
          !studentProfile.target_year ||
          !studentProfile.class_level;

        onIncompleteChange?.(incomplete);

        if (incomplete) {
          setIsEditing(true);
        }
      } else {
        setDraft({
          target_year: undefined,
          class_level: "",
          guardian_contact: "",
          daily_study_minutes: undefined,
          onboarding_state: "not_started",
        });

        setIsEditing(true);
        onIncompleteChange?.(true);
      }

      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [onProfileChange]);

  // -----------------------------------------------------
  // Validation
  // -----------------------------------------------------

  const isValid =
    !!draft.target_year &&
    !!draft.class_level?.trim();

  // -----------------------------------------------------
  // Save
  // -----------------------------------------------------

  const handleSave = async () => {
    if (!isValid) return;

    setSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.error("No authenticated user found");
        return;
      }

      const saved = await saveStudentProfile(
        user.id,
        draft
      );

      if (saved) {
        setProfile(saved);
        setDraft(saved);

        onProfileChange?.(saved);

        onIncompleteChange?.(
          !saved.target_year ||
            !saved.class_level
        );

        setIsEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------
  // Loading
  // -----------------------------------------------------

  if (loading) {
    return (
      <div className="bg-white dark:bg-[var(--navy)] rounded-[24px] p-6 border border-slate-200 dark:border-slate-700 h-48 animate-pulse" />
    );
  }

  const isIncomplete =
    !profile?.target_year ||
    !profile?.class_level;

  // -----------------------------------------------------
  // UI
  // -----------------------------------------------------

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-teal-50 dark:bg-teal-950/40 text-[var(--teal)] dark:text-[#FCB824] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-xl">
              account_circle
            </span>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("Your Profile")}
            </h3>

            {appUser?.full_name && (
              <p className="text-xs font-semibold text-[#00243B] dark:text-white mt-1">
                {appUser.full_name}
              </p>
            )}

            {isIncomplete && !isEditing && (
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                {t("Incomplete — please fill in your details")}
              </p>
            )}
          </div>
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-slate-400 hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors p-1"
          >
            <span className="material-symbols-outlined text-[18px]">
              edit
            </span>
          </button>
        )}
      </div>

      {/* EDIT MODE */}
      {isEditing ? (
        <div className="space-y-4">

          {/* Name - Read Only */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Name")}
            </label>

            <input
              type="text"
              value={appUser?.full_name || ""}
              disabled
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl w-full text-[#00243B] dark:text-white opacity-70 cursor-not-allowed"
            />
          </div>

          {/* Email - Read Only */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Email")}
            </label>

            <input
              type="email"
              value={appUser?.email || ""}
              disabled
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl w-full text-[#00243B] dark:text-white opacity-70 cursor-not-allowed"
            />
          </div>

          {/* Target Exam Year */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Target Exam Year")}
            </label>

            <input
              type="number"
              value={draft.target_year ?? ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  target_year: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
              placeholder={t("e.g. 2027")}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            />
          </div>

          {/* Class */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Grade / Class")}
            </label>

            <select
              value={draft.class_level || ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  class_level: e.target.value,
                }))
              }
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            >
              <option value="">
                {t("Select")}
              </option>

              {CLASS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Guardian Contact */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Guardian Contact")}
              <span className="ml-1.5 normal-case font-medium text-slate-400">
                {t("(optional)")}
              </span>
            </label>

            <input
              type="tel"
              value={draft.guardian_contact || ""}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  guardian_contact: e.target.value,
                }))
              }
              placeholder={t("Guardian phone number")}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            />
          </div>

          {/* Daily Study Minutes */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Daily Study Time")}
            </label>

            <div className="relative">
              <input
                type="number"
                min="0"
                value={
                  draft.daily_study_minutes ?? ""
                }
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    daily_study_minutes: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                  }))
                }
                placeholder={t("e.g. 180")}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                min/day
              </span>
            </div>
          </div>

          {/* Onboarding State */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Onboarding Status")}
            </label>

            <select
              value={
                draft.onboarding_state ||
                "not_started"
              }
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  onboarding_state:
                    e.target.value,
                }))
              }
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            >
              <option value="not_started">
                Not Started
              </option>

              <option value="in_progress">
                In Progress
              </option>

              <option value="completed">
                Completed
              </option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !isValid}
              className="flex-1 bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving
                ? t("Saving...")
                : t("Save Profile")}
            </button>

            {profile && (
              <button
                onClick={() => {
                  setDraft(profile);
                  setIsEditing(false);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
              >
                {t("Cancel")}
              </button>
            )}
          </div>
        </div>
      ) : (
        /* VIEW MODE */
        <div className="grid grid-cols-2 gap-4 text-sm">

          {/* Name */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("Name")}
            </p>

            <p className="font-semibold text-[#00243B] dark:text-white">
              {appUser?.full_name || "—"}
            </p>
          </div>

          {/* Email */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("Email")}
            </p>

            <p className="font-semibold text-[#00243B] dark:text-white truncate">
              {appUser?.email || "—"}
            </p>
          </div>

          {/* Target Year */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("Exam Year")}
            </p>

            <p className="font-semibold text-[#00243B] dark:text-white">
              {profile?.target_year || "—"}
            </p>
          </div>

          {/* Class */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("Grade / Class")}
            </p>

            <p className="font-semibold text-[#00243B] dark:text-white">
              {profile?.class_level || "—"}
            </p>
          </div>

          {/* Phone */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("Phone")}
            </p>

            <p className="font-semibold text-[#00243B] dark:text-white">
              {appUser?.mobile_number || "—"}
            </p>
          </div>

          {/* Guardian */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("Guardian Contact")}
            </p>

            <p className="font-semibold text-[#00243B] dark:text-white">
              {profile?.guardian_contact || "—"}
            </p>
          </div>

          {/* Daily Study */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("Daily Study")}
            </p>

            <p className="font-semibold text-[#00243B] dark:text-white">
              {profile?.daily_study_minutes
                ? `${profile.daily_study_minutes} min/day`
                : "—"}
            </p>
          </div>

          {/* Onboarding */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t("Onboarding")}
            </p>

            <p className="font-semibold text-[#00243B] dark:text-white capitalize">
              {profile?.onboarding_state
                ?.replace(/_/g, " ") || "—"}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}