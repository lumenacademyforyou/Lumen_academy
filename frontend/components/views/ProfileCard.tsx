import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { motion } from "motion/react";
import { fetchMe, updateMe, MeProfile } from "../../lib/meApi";

interface ProfileCardProps {
  onProfileChange?: (profile: MeProfile) => void;
  onIncompleteChange?: (incomplete: boolean) => void;
}

const CLASS_OPTIONS = ["11th", "12th", "Dropper / Repeater"];

type StudentProfileDraft = NonNullable<MeProfile["studentProfile"]>;

const EMPTY_DRAFT: StudentProfileDraft = {
  targetYear: null,
  classLevel: null,
  guardianContact: null,
  dailyStudyMinutes: null,
  onboardingState: "not_started",
};

// Reads/writes through backend/services/meProfile.service.ts's single
// GET/PATCH /api/me (LA-BE-CORE-002 CL-P4) — previously this component did
// up to three sequential PostgREST round trips on its own (fetchAppUser,
// then fetchStudentProfile, which called fetchAppUser again internally,
// then a second query for core.student_profile), directly from the
// browser into a schema PostgREST isn't supposed to expose at all (CL-P0).
export function ProfileCard({ onProfileChange, onIncompleteChange }: ProfileCardProps) {
  const { t } = useLanguage();

  const [profile, setProfile] = useState<MeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<StudentProfileDraft>(EMPTY_DRAFT);

  useEffect(() => {
    let isMounted = true;

    fetchMe()
      .then((me) => {
        if (!isMounted) return;
        setProfile(me);
        const incomplete = !me.studentProfile?.targetYear || !me.studentProfile?.classLevel;
        if (me.studentProfile) {
          setDraft(me.studentProfile);
        } else {
          setDraft(EMPTY_DRAFT);
        }
        onProfileChange?.(me);
        onIncompleteChange?.(incomplete);
        if (incomplete) setIsEditing(true);
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
        onIncompleteChange?.(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isValid = !!draft.targetYear && !!draft.classLevel?.trim();

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const updated = await updateMe({ studentProfile: draft });
      setProfile(updated);
      if (updated.studentProfile) setDraft(updated.studentProfile);
      onProfileChange?.(updated);
      onIncompleteChange?.(!updated.studentProfile?.targetYear || !updated.studentProfile?.classLevel);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="bg-white dark:bg-[var(--navy)] rounded-[24px] p-6 border border-slate-200 dark:border-slate-700 h-48 animate-pulse" />;
  }

  const isIncomplete = !profile?.studentProfile?.targetYear || !profile?.studentProfile?.classLevel;

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
            <span className="material-symbols-outlined text-xl">account_circle</span>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t("Your Profile")}</h3>

            {profile?.fullName && <p className="text-xs font-semibold text-[#00243B] dark:text-white mt-1">{profile.fullName}</p>}

            {isIncomplete && !isEditing && (
              <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">{t("Incomplete — please fill in your details")}</p>
            )}
          </div>
        </div>

        {!isEditing && (
          <button onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors p-1">
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        )}
      </div>

      {/* EDIT MODE */}
      {isEditing ? (
        <div className="space-y-4">
          {/* Name - Read Only (change it from the header's "Edit Profile" instead) */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">{t("Name")}</label>
            <input
              type="text"
              value={profile?.fullName || ""}
              disabled
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl w-full text-[#00243B] dark:text-white opacity-70 cursor-not-allowed"
            />
          </div>

          {/* Email - Read Only, tied to the verified Supabase identity */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">{t("Email")}</label>
            <input
              type="email"
              value={profile?.email || ""}
              disabled
              className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl w-full text-[#00243B] dark:text-white opacity-70 cursor-not-allowed"
            />
          </div>

          {/* Target Exam Year */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">{t("Target Exam Year")}</label>
            <input
              type="number"
              value={draft.targetYear ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, targetYear: e.target.value ? Number(e.target.value) : null }))}
              placeholder={t("e.g. 2027")}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            />
          </div>

          {/* Class */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">{t("Grade / Class")}</label>
            <select
              value={draft.classLevel || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, classLevel: e.target.value }))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            >
              <option value="">{t("Select")}</option>
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
              <span className="ml-1.5 normal-case font-medium text-slate-400">{t("(optional)")}</span>
            </label>
            <input
              type="tel"
              value={draft.guardianContact || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, guardianContact: e.target.value }))}
              placeholder={t("Guardian phone number")}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            />
          </div>

          {/* Daily Study Minutes */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">{t("Daily Study Time")}</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                value={draft.dailyStudyMinutes ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, dailyStudyMinutes: e.target.value ? Number(e.target.value) : null }))}
                placeholder={t("e.g. 180")}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">min/day</span>
            </div>
          </div>

          {/* Onboarding State */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">{t("Onboarding Status")}</label>
            <select
              value={draft.onboardingState || "not_started"}
              onChange={(e) => setDraft((prev) => ({ ...prev, onboardingState: e.target.value as StudentProfileDraft["onboardingState"] }))}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            >
              <option value="not_started">Not Started</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !isValid}
              className="flex-1 bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? t("Saving...") : t("Save Profile")}
            </button>

            {profile?.studentProfile && (
              <button
                onClick={() => {
                  setDraft(profile.studentProfile!);
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
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Name")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.fullName || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Email")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white truncate">{profile?.email || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Exam Year")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.studentProfile?.targetYear || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Grade / Class")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.studentProfile?.classLevel || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Phone")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.mobileNumber || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Guardian Contact")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.studentProfile?.guardianContact || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Daily Study")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">
              {profile?.studentProfile?.dailyStudyMinutes ? `${profile.studentProfile.dailyStudyMinutes} min/day` : "—"}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Onboarding")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white capitalize">{profile?.studentProfile?.onboardingState?.replace(/_/g, " ") || "—"}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
