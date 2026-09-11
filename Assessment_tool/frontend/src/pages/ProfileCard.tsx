import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion } from "motion/react";
import { fetchMe, updateMe, MeProfile } from "../services/meApi";

interface ProfileCardProps {
  onProfileChange?: (profile: MeProfile) => void;
  onIncompleteChange?: (incomplete: boolean) => void;
}

const CLASS_OPTIONS = ["11th", "12th", "Dropper / Repeater"];

// LA-UX-REFRESH-001 F2. Both vocabularies mirror migration 048's CHECK
// constraints exactly — the stored value is the machine code, the label is
// what the student reads.
const INSTITUTION_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "school", label: "School" },
  { value: "college", label: "College" },
  { value: "university", label: "University" },
  { value: "coaching_centre", label: "Coaching Centre" },
  { value: "other", label: "Other" },
];

const STUDY_STAGE_OPTIONS: { value: string; label: string }[] = [
  { value: "secondary", label: "Secondary" },
  { value: "higher_secondary", label: "Higher Secondary" },
  { value: "undergraduate", label: "Undergraduate" },
  { value: "postgraduate", label: "Postgraduate" },
  { value: "dropper", label: "Dropper / Repeater" },
  { value: "other", label: "Other" },
];

// The study-time target is a tag now, not a free-text minutes box: a student
// picking a daily target is choosing between a handful of realistic slots,
// not typing an arbitrary number. Stored unit is still minutes (migration 048
// deliberately keeps daily_study_minutes) so tags stay comparable with values
// recorded before this change.
const STUDY_TIME_TAGS = [30, 45, 60, 90, 120, 180];

function formatStudyTime(minutes: number | null | undefined): string {
  if (!minutes) return "—";
  if (minutes < 60) return `${minutes} mins`;
  const hours = minutes / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} hr${hours === 1 ? "" : "s"}`;
}

function labelOf(options: { value: string; label: string }[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value;
}

type StudentProfileDraft = NonNullable<MeProfile["studentProfile"]>;

const EMPTY_DRAFT: StudentProfileDraft = {
  targetYear: null,
  classLevel: null,
  guardianContact: null,
  dailyStudyMinutes: null,
  onboardingState: "not_started",
  institutionKind: null,
  institutionName: null,
  institutionLocation: null,
  studyStage: null,
  studyYear: null,
  dateOfBirth: null,
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState<StudentProfileDraft>(EMPTY_DRAFT);
  // Mobile number lives on core.app_user, not core.student_profile, so it is
  // a separate patch field — but it belongs in this form, since "my phone
  // number" is plainly part of "my profile" to the person filling it in.
  const [mobileDraft, setMobileDraft] = useState("");

  useEffect(() => {
    let isMounted = true;

    fetchMe()
      .then((me) => {
        if (!isMounted) return;
        setProfile(me);
        const incomplete = !me.studentProfile?.targetYear || !me.studentProfile?.classLevel;
        setDraft(me.studentProfile ? { ...EMPTY_DRAFT, ...me.studentProfile } : EMPTY_DRAFT);
        setMobileDraft(me.mobileNumber ?? "");
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
    setSaveError(null);
    try {
      const trimmedMobile = mobileDraft.trim();
      const updated = await updateMe({
        // Only send the mobile number when it actually changed — the backend
        // schema requires 7-20 characters, so patching an untouched empty
        // field would turn a save of everything else into a 400.
        ...(trimmedMobile !== (profile?.mobileNumber ?? "") ? { mobileNumber: trimmedMobile || null } : {}),
        studentProfile: {
          targetYear: draft.targetYear,
          classLevel: draft.classLevel,
          guardianContact: draft.guardianContact,
          dailyStudyMinutes: draft.dailyStudyMinutes,
          institutionKind: draft.institutionKind,
          institutionName: draft.institutionName,
          institutionLocation: draft.institutionLocation,
          studyStage: draft.studyStage,
          studyYear: draft.studyYear,
          dateOfBirth: draft.dateOfBirth,
        },
      });
      setProfile(updated);
      setDraft(updated.studentProfile ? { ...EMPTY_DRAFT, ...updated.studentProfile } : EMPTY_DRAFT);
      setMobileDraft(updated.mobileNumber ?? "");
      onProfileChange?.(updated);
      onIncompleteChange?.(!updated.studentProfile?.targetYear || !updated.studentProfile?.classLevel);
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setSaveError(err instanceof Error ? err.message : "Could not save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="bg-white dark:bg-[var(--navy)] rounded-[24px] p-6 border border-slate-200 dark:border-slate-700 h-48 animate-pulse" />;
  }

  const isIncomplete = !profile?.studentProfile?.targetYear || !profile?.studentProfile?.classLevel;
  const inputClass =
    "bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--teal)] w-full text-[#00243B] dark:text-white";
  const readOnlyInputClass =
    "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold px-3.5 py-2 rounded-xl w-full text-[#00243B] dark:text-white opacity-70 cursor-not-allowed";
  const labelClass = "text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block";
  const sectionHeadingClass = "text-[11px] font-black uppercase tracking-widest text-[var(--teal)] dark:text-[#FCB824] pt-2";

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

      {/* Plan status — LA-UX-REFRESH-001 F3. Real subscription row, or an
          honest "no plan" line; onboarding completes itself once a plan is
          active and the required fields are filled, so there is no manual
          onboarding control here any more. */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-2xl">
        <span className="material-symbols-outlined text-[18px] text-[var(--teal)] dark:text-[#FCB824]">
          {profile?.subscription?.isActive ? "verified" : "info"}
        </span>
        <span className="text-xs font-bold text-[#00243B] dark:text-white">
          {profile?.subscription ? profile.subscription.tierName : t("No active plan")}
        </span>
        {profile?.subscription && (
          <span
            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
              profile.subscription.isActive
                ? "bg-[#FCB824] text-[#00243B]"
                : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
            }`}
          >
            {profile.subscription.isActive ? t("Active") : profile.subscription.status}
          </span>
        )}
        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 ml-auto">
          {t("Onboarding")}: {profile?.studentProfile?.onboardingState?.replace(/_/g, " ") ?? "not started"}
        </span>
      </div>

      {/* EDIT MODE */}
      {isEditing ? (
        <div className="space-y-4">
          <p className={sectionHeadingClass}>{t("Personal")}</p>

          {/* Name - Read Only (change it from the header's "Edit Profile" instead) */}
          <div>
            <label className={labelClass}>{t("Name")}</label>
            <input type="text" value={profile?.fullName || ""} disabled className={readOnlyInputClass} />
          </div>

          {/* Email - Read Only, tied to the verified Supabase identity */}
          <div>
            <label className={labelClass}>{t("Email")}</label>
            <input type="email" value={profile?.email || ""} disabled className={readOnlyInputClass} />
          </div>

          {/* Mobile Number */}
          <div>
            <label className={labelClass}>{t("Mobile Number")}</label>
            <input
              type="tel"
              value={mobileDraft}
              onChange={(e) => setMobileDraft(e.target.value)}
              placeholder={t("e.g. +91 98765 43210")}
              className={inputClass}
            />
          </div>

          {/* Date of Birth */}
          <div>
            <label className={labelClass}>{t("Date of Birth")}</label>
            <input
              type="date"
              value={draft.dateOfBirth ?? ""}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDraft((prev) => ({ ...prev, dateOfBirth: e.target.value || null }))}
              className={inputClass}
            />
          </div>

          {/* Guardian Contact */}
          <div>
            <label className={labelClass}>
              {t("Guardian Contact")}
              <span className="ml-1.5 normal-case font-medium text-slate-400">{t("(optional)")}</span>
            </label>
            <input
              type="tel"
              value={draft.guardianContact || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, guardianContact: e.target.value }))}
              placeholder={t("Guardian phone number")}
              className={inputClass}
            />
          </div>

          <p className={sectionHeadingClass}>{t("Institute")}</p>

          {/* Institution kind */}
          <div>
            <label className={labelClass}>{t("Institute Type")}</label>
            <select
              value={draft.institutionKind || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, institutionKind: e.target.value || null }))}
              className={inputClass}
            >
              <option value="">{t("Select")}</option>
              {INSTITUTION_KIND_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Institution name */}
          <div>
            <label className={labelClass}>{t("Institute Name")}</label>
            <input
              type="text"
              value={draft.institutionName || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, institutionName: e.target.value }))}
              placeholder={t("e.g. Velammal Matric Hr. Sec. School")}
              className={inputClass}
            />
          </div>

          {/* Institution location */}
          <div>
            <label className={labelClass}>{t("Institute Location")}</label>
            <input
              type="text"
              value={draft.institutionLocation || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, institutionLocation: e.target.value }))}
              placeholder={t("City / area")}
              className={inputClass}
            />
          </div>

          <p className={sectionHeadingClass}>{t("Studies")}</p>

          {/* Study stage */}
          <div>
            <label className={labelClass}>{t("Stage of Study")}</label>
            <select
              value={draft.studyStage || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, studyStage: e.target.value || null }))}
              className={inputClass}
            >
              <option value="">{t("Select")}</option>
              {STUDY_STAGE_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>

          {/* Year / standard / course */}
          <div>
            <label className={labelClass}>{t("Year / Standard / Course")}</label>
            <input
              type="text"
              value={draft.studyYear || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, studyYear: e.target.value }))}
              placeholder={t("e.g. 12th Standard, 2nd Year B.Sc. Zoology")}
              className={inputClass}
            />
          </div>

          {/* Class (NEET grade bucket the test engine already uses) */}
          <div>
            <label className={labelClass}>{t("Grade / Class")}</label>
            <select
              value={draft.classLevel || ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, classLevel: e.target.value }))}
              className={inputClass}
            >
              <option value="">{t("Select")}</option>
              {CLASS_OPTIONS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          {/* Target Exam Year */}
          <div>
            <label className={labelClass}>{t("Target Exam Year")}</label>
            <input
              type="number"
              value={draft.targetYear ?? ""}
              onChange={(e) => setDraft((prev) => ({ ...prev, targetYear: e.target.value ? Number(e.target.value) : null }))}
              placeholder={t("e.g. 2027")}
              className={inputClass}
            />
          </div>

          {/* Daily study target — fixed tags, not a free-text minutes box */}
          <div>
            <label className={labelClass}>{t("Daily Study Target")}</label>
            <div className="flex flex-wrap gap-2">
              {STUDY_TIME_TAGS.map((minutes) => {
                const selected = draft.dailyStudyMinutes === minutes;
                return (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, dailyStudyMinutes: prev.dailyStudyMinutes === minutes ? null : minutes }))
                    }
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer ${
                      selected
                        ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] border-transparent shadow-sm"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-[var(--teal)] dark:hover:border-[#FCB824]"
                    }`}
                  >
                    {formatStudyTime(minutes)}
                  </button>
                );
              })}
            </div>
          </div>

          {saveError && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl px-3 py-2">
              {saveError}
            </p>
          )}

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
                  setDraft({ ...EMPTY_DRAFT, ...profile.studentProfile! });
                  setMobileDraft(profile.mobileNumber ?? "");
                  setSaveError(null);
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
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Mobile Number")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.mobileNumber || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Date of Birth")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.studentProfile?.dateOfBirth || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Institute Type")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">
              {labelOf(INSTITUTION_KIND_OPTIONS, profile?.studentProfile?.institutionKind)}
            </p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Institute Name")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white truncate">{profile?.studentProfile?.institutionName || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Institute Location")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white truncate">{profile?.studentProfile?.institutionLocation || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Stage of Study")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{labelOf(STUDY_STAGE_OPTIONS, profile?.studentProfile?.studyStage)}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Year / Standard / Course")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white truncate">{profile?.studentProfile?.studyYear || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Grade / Class")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.studentProfile?.classLevel || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Exam Year")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.studentProfile?.targetYear || "—"}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Daily Study Target")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{formatStudyTime(profile?.studentProfile?.dailyStudyMinutes)}</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{t("Guardian Contact")}</p>
            <p className="font-semibold text-[#00243B] dark:text-white">{profile?.studentProfile?.guardianContact || "—"}</p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
