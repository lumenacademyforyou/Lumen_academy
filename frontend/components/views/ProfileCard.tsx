
import React, { useState, useEffect } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { motion } from "motion/react";
import {
  fetchStudentProfile,
  saveStudentProfile,
  StudentProfile,
  supabase,
} from "../../supabase";

const SUBJECT_OPTIONS_BY_STREAM: Record<string, string[]> = {
  NEET: ["Physics", "Chemistry", "Biology"],
  JEE: ["Physics", "Chemistry", "Mathematics"],
};

const GRADE_OPTIONS = ["11th", "12th", "Dropper / Repeater"];

// Fields below are all optional — never pre-filled, never defaulted.
// They stay blank until the student explicitly enters and saves them.

interface ProfileCardProps {
  // Lets the parent dashboard (mock-test filtering, greeting, etc.)
  // react to the real profile instead of holding its own copy.
  onProfileChange?: (profile: StudentProfile) => void;
  // Fires whenever completeness status is known/changes, so the dashboard
  // can show a "please complete your profile" warning banner.
  onIncompleteChange?: (incomplete: boolean) => void;
}

export function ProfileCard({ onProfileChange, onIncompleteChange }: ProfileCardProps) {
  const { t } = useLanguage();
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Partial<StudentProfile>>({});

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        if (isMounted) setLoading(false);
        return;
      }

      const prof = await fetchStudentProfile(user.id);
      if (!isMounted) return;

      if (prof) {
        setProfile(prof);
        setDraft(prof);
        onProfileChange?.(prof);
        const incomplete = !prof.display_name || !prof.target_stream || !prof.preferred_subjects?.length;
        onIncompleteChange?.(incomplete);
        // Required fields missing → walk the user straight into edit mode
        // instead of rendering blanks or invented defaults.
        if (incomplete) {
          setIsEditing(true);
        }
      } else {
        setDraft({ user_id: user.id, email: user.email || "" });
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

  const streamKey: "NEET" | "JEE" = draft.target_stream?.toUpperCase().includes("JEE") ? "JEE" : "NEET";
  const availableSubjects = SUBJECT_OPTIONS_BY_STREAM[streamKey];

  const selectStream = (stream: "NEET" | "JEE") => {
    setDraft((prev) => ({
      ...prev,
      target_stream: stream,
      // Reset subjects to the new stream's defaults; user can still deselect any.
      preferred_subjects: SUBJECT_OPTIONS_BY_STREAM[stream],
    }));
  };

  const toggleDraftSubject = (subject: string) => {
    setDraft((prev) => {
      const current = prev.preferred_subjects || [];
      const next = current.includes(subject)
        ? current.filter((s) => s !== subject)
        : [...current, subject];
      return { ...prev, preferred_subjects: next };
    });
  };

  const isValid =
    !!draft.display_name?.trim() &&
    !!draft.target_stream &&
    (draft.preferred_subjects || []).length > 0;

  const handleSave = async () => {
    if (!isValid) return;
    setSaving(true);
    try {
      const saved = await saveStudentProfile(draft);
      if (saved) {
        setProfile(saved);
        setDraft(saved);
        onProfileChange?.(saved);
        onIncompleteChange?.(
          !saved.display_name || !saved.target_stream || !saved.preferred_subjects?.length
        );
        setIsEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-[var(--navy)] rounded-[24px] p-6 border border-slate-200 dark:border-slate-700 h-48 animate-pulse" />
    );
  }

  const isIncomplete =
    !profile?.display_name || !profile?.target_stream || !profile?.preferred_subjects?.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] p-6 shadow-sm border border-slate-200 dark:border-slate-700 space-y-5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-teal-50 dark:bg-teal-950/40 text-[var(--teal)] dark:text-[#FCB824] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-xl">account_circle</span>
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t("Your Profile")}
            </h3>
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
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Display Name")}
            </label>
            <input
              type="text"
              value={draft.display_name || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, display_name: e.target.value }))}
              placeholder={t("Your name")}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Target Exam")}
            </label>
            <div className="flex gap-2">
              {(["NEET", "JEE"] as const).map((stream) => (
                <button
                  key={stream}
                  type="button"
                  onClick={() => selectStream(stream)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                    streamKey === stream && draft.target_stream
                      ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] border-transparent"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {stream}
                </button>
              ))}
            </div>
          </div>

          {draft.target_stream && (
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                {t("Preferred Subjects")}
              </label>
              <div className="flex flex-wrap gap-2">
                {availableSubjects.map((subject) => {
                  const active = (draft.preferred_subjects || []).includes(subject);
                  return (
                    <button
                      key={subject}
                      type="button"
                      onClick={() => toggleDraftSubject(subject)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        active
                          ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] border-transparent"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {active ? "✓ " : "+ "}
                      {subject}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                {t("Target Exam Year")}
              </label>
              <input
                type="number"
                value={draft.target_exam_year ?? ""}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    target_exam_year: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                placeholder={t("e.g. 2027")}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                {t("Grade / Class")}
              </label>
              <select
                value={draft.grade_class || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, grade_class: e.target.value }))}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
              >
                <option value="">{t("Select")}</option>
                {GRADE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
              {t("Phone Number")}
              <span className="ml-1.5 normal-case font-medium text-slate-400">{t("(optional)")}</span>
            </label>
            <input
              type="tel"
              value={draft.phone_number || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, phone_number: e.target.value }))}
              placeholder={t("e.g. 98765 43210")}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                {t("School / Coaching")}
                <span className="ml-1.5 normal-case font-medium text-slate-400">{t("(optional)")}</span>
              </label>
              <input
                type="text"
                value={draft.school_or_coaching || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, school_or_coaching: e.target.value }))}
                placeholder={t("e.g. Aakash Institute")}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                {t("City")}
                <span className="ml-1.5 normal-case font-medium text-slate-400">{t("(optional)")}</span>
              </label>
              <input
                type="text"
                value={draft.city || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, city: e.target.value }))}
                placeholder={t("e.g. Erode")}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white"
              />
            </div>
          </div>


          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSave}
              disabled={saving || !isValid}
              className="flex-1 bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {saving ? t("Saving...") : t("Save Profile")}
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
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Name")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.display_name}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Target Exam")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.target_stream}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Exam Year")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.target_exam_year || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Grade / Class")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.grade_class || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Phone")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.phone_number || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("School / Coaching")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.school_or_coaching || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("City")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.city || "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              {t("Preferred Subjects")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(profile?.preferred_subjects || []).map((s) => (
                <span
                  key={s}
                  className="px-2.5 py-1 rounded-lg bg-teal-50 dark:bg-teal-950/40 text-[var(--teal)] dark:text-[#FCB824] text-[11px] font-bold"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}