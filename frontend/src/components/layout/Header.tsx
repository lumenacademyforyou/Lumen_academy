import React, { useState, useEffect } from "react";
import LumenLogo from "../ui/LumenLogo";
import Modal from "./Modal";
import { useLanguage } from "../../contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { fetchStudySessions, calculateStudyStreak } from "../../services/studySessionService";
import { supabase } from "../../services/supabase";
import { fetchMe, updateMe, deleteAccount, MeProfile } from "../../services/meApi";
import { sendEmailOtp, verifyEmailOtp, describeAuthError } from "../../services/supabaseAuth";
import { ApiError } from "../../services/api";
import NotificationBell from "../ui/NotificationBell";
import { pluralize } from "../../utils/pluralize";
import { isDemoEmail } from "../../services/demoSession";

interface HeaderProps {
  currentTab: string;
  setTab: (tab: string) => void;
  studentName: string;
  setStudentName: (name: string) => void;
  onSignOut: () => void;
}

export default function Header({ currentTab, setTab, studentName, setStudentName, onSignOut }: HeaderProps) {
  const { t } = useLanguage();
 
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [studyStreak, setStudyStreak] = useState(0);
  const navigate = useNavigate();
  const handleNavigation = (tab: string) => {
  const tabToPath: Record<string, string> = {
    dashboard: "/dashboard",
    course: "/course",
    tests: "/tests",
    analytics: "/analytics",
    results: "/results",
  };

  setTab(tab);

  const path = tabToPath[tab];

  if (path) {
    navigate(path);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
};


  
  // Global Dark Mode State (Syncs with html.dark & localStorage)
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lumen_theme");
      if (saved === "dark") return true;
      if (saved === "light") return false;
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  React.useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("lumen_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.setAttribute("data-theme", "light");
      localStorage.setItem("lumen_theme", "light");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  // Modals for My Profile & Account Settings
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Profile Form States
  const [profile, setProfile] = useState<MeProfile | null>(null);
const [editedName, setEditedName] = useState("");
const [phone, setPhone] = useState("");
const [targetExam, setTargetExam] = useState<"" | "NEET" | "JEE">("");
const [profileSuccessMsg, setProfileSuccessMsg] = useState("");

  // Account Settings States
  const [settingsTab, setSettingsTab] = useState<"security" | "notifications" | "appearance">("security");
  const [currPassword, setCurrPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState(true);

  // Notification Prefs
  const [emailDiagnosticReports, setEmailDiagnosticReports] = useState(true);
  const [dailyReminders, setDailyReminders] = useState(true);
  const [whatsappUpdates, setWhatsappUpdates] = useState(false);

  // Settings Feedback
  const [settingsSuccessMsg, setSettingsSuccessMsg] = useState("");

  // Delete Account (OTP-gated) States
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"warn" | "otp">("warn");
  const [deleteOtpCode, setDeleteOtpCode] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteOtpSent, setDeleteOtpSent] = useState(false);

  const resetDeleteFlow = () => {
    setShowDeleteAccountModal(false);
    setDeleteStep("warn");
    setDeleteOtpCode("");
    setDeleteError("");
    setDeleteLoading(false);
    setDeleteOtpSent(false);
  };

  const handleSendDeleteOtp = async () => {
    if (!profile?.email) {
      setDeleteError("No verified email on this account to send a code to.");
      return;
    }
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await sendEmailOtp(profile.email, false);
      setDeleteOtpSent(true);
      setDeleteStep("otp");
    } catch (err) {
      setDeleteError(describeAuthError(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    if (!profile?.email || deleteOtpCode.trim().length === 0) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      // Verifying the code mints a fresh session carrying the recent-otp
      // amr claim the backend requires (see meApi.ts's deleteAccount doc
      // comment) — the delete call right after picks that session up
      // automatically.
      await verifyEmailOtp(profile.email, deleteOtpCode.trim());
      await deleteAccount();
      await supabase.auth.signOut();
      window.location.assign("/");
    } catch (err) {
      if (err instanceof ApiError) {
        setDeleteError(err.message);
      } else {
        setDeleteError(describeAuthError(err));
      }
      setDeleteLoading(false);
    }
  };

  const updateStreak = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setStudyStreak(0);
        return;
      }
      const sessions = await fetchStudySessions(user.id);
      setStudyStreak(calculateStudyStreak(sessions));
    } catch (err) {
      console.error("Failed to update streak:", err);
    }
  };

  useEffect(() => {
    updateStreak();
    const handleSessionSaved = () => updateStreak();
    window.addEventListener("lumen_session_saved", handleSessionSaved);
    return () => window.removeEventListener("lumen_session_saved", handleSessionSaved);
  }, []);


useEffect(() => {
  // One call replaces what used to be fetchAppUser() + fetchStudentProfile()
  // (which itself called fetchAppUser() a second time) — see
  // backend/services/meProfile.service.ts (LA-BE-CORE-002 CL-P4). This is
  // the fetch that runs immediately after sign-in, since Header is always
  // mounted — the one most responsible for S-3's "long delay right after
  // sign-in" symptom.
  const loadProfile = async () => {
    try {
      const me = await fetchMe();
      setProfile(me);
      setStudentName(me.fullName || "");
      setEditedName(me.fullName || "");
      setPhone(me.mobileNumber || "");
      setTargetExam(me.targetExam === "JEE" ? "JEE" : "NEET");
    } catch (error) {
      console.error("Failed to load header profile:", error);
      setStudentName("");
    }
  };

  loadProfile();
}, [setStudentName]);

const handleSaveProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!editedName.trim()) return;

  try {
    const saved = await updateMe({
      fullName: editedName.trim(),
      mobileNumber: phone.trim() || null,
      ...(targetExam ? { targetExam } : {}),
    });
    setProfile(saved);
    setStudentName(saved.fullName);
    setProfileSuccessMsg("Profile updated successfully!");
    setTimeout(() => {
      setProfileSuccessMsg("");
      setShowProfileModal(false);
    }, 1200);
  } catch (error) {
    console.error("Failed to save profile:", error);
  }
};

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSuccessMsg("Account settings saved successfully!");
    setTimeout(() => {
      setSettingsSuccessMsg("");
      setShowSettingsModal(false);
    }, 1200);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-r from-slate-50 via-white to-amber-50/50 dark:from-[var(--navy)] dark:via-[var(--navy)] dark:to-[var(--navy)] backdrop-blur-md border-b border-amber-200/50 dark:border-amber-900/50 shadow-sm flex flex-col justify-center print:hidden">
        <div className="h-20 md:h-22 py-2 flex items-center justify-between px-3 sm:px-6 md:px-8 w-full max-w-[1360px] mx-auto min-w-0">
          {/* Left section: Logo & Desktop Nav Links */}
          <div className="flex items-center gap-3 xl:gap-8 min-w-0">
            <div 
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer shrink-0" 
              onClick={() => { setTab("dashboard"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <LumenLogo className="w-[42px] sm:w-[50px] md:w-[56px] h-[42px] sm:h-[50px] md:h-[56px]  transition-transform hover:scale-105 duration-200" />
              <div className="flex flex-col justify-center leading-tight hidden sm:flex">
                <span className="font-black text-lg md:text-xl text-[var(--navy)] dark:text-white tracking-tight font-sans leading-none">
                  LUMEN ACADEMY
                </span>
                <span className="text-[8px] md:text-[9px] font-bold text-slate-500 dark:text-amber-300/90 tracking-wider mt-0.5 uppercase whitespace-nowrap">
                  Empowering Future through Learning
                </span>
              </div>
            </div>
            
            {/* Desktop Navigation Links (xl breakpoint to prevent crowding) */}
            <nav className="hidden xl:flex items-center gap-6 2xl:gap-8 py-1 pl-6 ml-2 border-l border-slate-200/60 dark:border-slate-700">
              {[
                { id: "dashboard", label: "Dashboard" },
                { id: "course", label: "Course" },
                { id: "tests", label: "Tests" },
                { id: "analytics", label: "Analytics" },
              ].map((item) => (
                <button
  key={item.id}
  onClick={() => handleNavigation(item.id)}
  className={`font-sans font-bold text-xs tracking-wide transition-all pb-1 cursor-pointer whitespace-nowrap flex items-center gap-1 shrink-0 ${
    currentTab === item.id
      ? "text-[#FCB824] dark:text-[#FCB824] border-b-2 border-[#FCB824]"
      : "text-slate-600 dark:text-slate-300 hover:text-[#FCB824]"
  }`}
>
  {t(item.label).toUpperCase()}
</button>
              ))}
            </nav>
          </div>

        {/* Right section: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* P1-6: subtle "Demo mode" badge — visible whenever the signed-in
              account is the shared demo user, so nobody mistakes seeded demo
              data/attempts for their own. */}
          {isDemoEmail(profile?.email) && (
            <span
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-full text-indigo-600 dark:text-indigo-400 font-bold text-[10px] shadow-sm uppercase tracking-wider shrink-0"
              title="You're signed in on the shared demo account — data here is sample data, not personal."
            >
              <span className="material-symbols-outlined text-[14px]">visibility</span>
              {t("Demo Mode")}
            </span>
          )}

          {/* Global Dark Mode Theme Toggle */}
          <button
            onClick={toggleDarkMode}
            className={`w-9 h-9 flex items-center justify-center rounded-2xl border transition-all cursor-pointer select-none shadow-sm shrink-0 ${
              isDarkMode
                ? "bg-[#00243B] text-[#FCB824] border-[#FCB824]/40 hover:bg-slate-700 hover:border-[#FCB824] shadow-inner"
                : "bg-amber-50/90 text-[#00243B] border-amber-200 hover:bg-amber-100 hover:border-[#FCB824]"
            }`}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
          >
            <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${isDarkMode ? "text-[#FCB824] rotate-180" : "text-[#ffd15c]"}`}>
              {isDarkMode ? "dark_mode" : "light_mode"}
            </span>
          </button>

          {/* Quick Log Out Button */}
          <button
            onClick={onSignOut}
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-[#FCB824] border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
            title="Log Out"
          >
            <span className="material-symbols-outlined text-sm text-amber-700 dark:text-[#FCB824]">logout</span>
            <span>{t("Log Out")}</span>
          </button>

       <NotificationBell profile={profile} />

          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700 relative shrink-0">
            {studyStreak > 0 && (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-full text-orange-600 dark:text-orange-400 font-bold text-[10px] shadow-sm" title={`${studyStreak} ${pluralize(studyStreak, "Day")} Study Streak`}>
                <span className="material-symbols-outlined text-[14px] text-orange-500">local_fire_department</span>
                {studyStreak}
              </div>
            )}

            <div   onClick={() => setShowProfileDropdown((prev) => !prev)}
            
              className="flex items-center gap-2.5 px-2.5 py-1.5 bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 rounded-full shadow-sm hover:shadow-md transition-all cursor-pointer select-none"
            >
<div className="h-9 w-9 rounded-full bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] font-black flex items-center justify-center text-sm shadow-md shrink-0">
  {studentName
    ? studentName.trim().charAt(0).toUpperCase()
    : ""}
</div>

<div className="flex flex-col text-left leading-tight hidden sm:flex">
  <span className="text-sm font-black text-[#00243B] dark:text-white truncate max-w-[140px]">
    {studentName || ""}
  </span>

  <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold tracking-wide">
    STUDENT
  </span>
</div>
            </div>

            {showProfileDropdown && (
              <>
                {/* Overlay backdrop to close dropdown when clicking outside */}
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowProfileDropdown(false)}
                />
                
                <div className="absolute right-0 top-14 w-72 bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.15)] border border-slate-200 dark:border-slate-700 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* Current Active Package Card inside Dropdown */}
                  <div className="mb-2 p-3 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-amber-950/40 dark:to-slate-900/60 border border-amber-200/80 dark:border-amber-800/50 rounded-2xl">
                    <div className="flex items-center justify-between text-xs font-black text-[#00243B] dark:text-white">
                      <span className="flex items-center gap-1 text-[11px] text-[var(--teal)] dark:text-[#FCB824]">
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        Achiever Pro Plan
                      </span>
                      <span className="bg-[#FCB824] text-[#00243B] text-[8px] font-black uppercase px-2 py-0.5 rounded-full">{t("Active")}</span>
                    </div>
                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-1">{t("Valid till May 2026 • Full Test Series")}</p>
                  </div>

                  <button 
                    onClick={() => {
                      setEditedName(studentName);
                      navigate("/profile");
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all text-left text-sm font-semibold text-[#00243B] dark:text-white group cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors text-[20px]">person</span>
                    <span>My Profile</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      handleNavigation("course");
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all text-left text-sm font-semibold text-[#00243B] dark:text-white group cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors text-[20px]">menu_book</span>
                    <span>Course & My Plan</span>
                  </button>

                  <button 
                    onClick={() => {
                      setEditedName(studentName);
                     navigate("/profile");
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all text-left text-sm font-semibold text-[#00243B] dark:text-white group cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors text-[20px]">inventory_2</span>
                    <span className="flex-1">{t("Package Details")}</span>
                    <span className="text-[10px] font-bold text-[var(--teal)] dark:text-[#FCB824] bg-amber-100/80 dark:bg-amber-950/60 px-2 py-0.5 rounded-md">{t("Pro")}</span>
                  </button>

                  <button
                    onClick={() => {
                    handleNavigation("results");
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all text-left text-sm font-semibold text-[#00243B] dark:text-white group cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors text-[20px]">bar_chart</span>
                    <span>{t("View Results")}</span>
                  </button>
                  
                  <button 
                    onClick={() => {
                      setShowSettingsModal(true);
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-xl transition-all text-left text-sm font-semibold text-[#00243B] dark:text-white group cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-slate-400 group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors text-[20px]">settings</span>
                    <span>Account Settings</span>
                  </button>
                  
                  <div className="my-1.5 border-t border-slate-200 dark:border-slate-700" />
                  
                  <button 
                    onClick={() => {
                      onSignOut();
                      setShowProfileDropdown(false);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-all text-left text-sm font-semibold text-[#ffd15c] dark:text-[#FCB824] group cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[#FCB824] group-hover:text-amber-700 transition-colors text-[20px]">logout</span>
                    <span>{t("Sign Out")}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

        {/* Mobile / Tablet Responsive Subnav Strip (shown when main header links are hidden) */}
        <div className="flex xl:hidden overflow-x-auto scrollbar-none px-4 py-2 border-t border-amber-200/30 dark:border-amber-900/30 gap-2 shrink-0 bg-gradient-to-r from-slate-50 via-white to-amber-50/50 dark:from-[var(--navy)] dark:via-[var(--navy)] dark:to-[var(--navy)]">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "course", label: "Course" },
            { id: "tests", label: "Tests" },
            { id: "analytics", label: "Analytics" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigation(item.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold tracking-wide transition-all whitespace-nowrap shrink-0 flex items-center gap-1 cursor-pointer ${
                currentTab === item.id
                  ? "bg-[var(--navy)] dark:bg-amber-950/80 text-[#FCB824] border border-[#FCB824] shadow-sm font-black"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {t(item.label).toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* MY PROFILE MODAL                                                   */}
      {/* ------------------------------------------------------------------ */}
      {showProfileModal && (
        <Modal onClose={() => setShowProfileModal(false)} backdropClassName="bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[32px] max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative">
            
            {/* Modal Header Banner */}
            <div className="bg-gradient-to-r from-[var(--navy)] via-[var(--teal)] to-[var(--navy)] p-6 text-white relative">
              <button
                onClick={() => setShowProfileModal(false)}
                className="absolute top-5 right-5 p-2 text-white/70 hover:text-white rounded-full hover:bg-white/10 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white text-[var(--teal)] font-black text-2xl flex items-center justify-center shadow-lg border-2 border-[#FCB824]">
                  {studentName ? studentName.charAt(0).toUpperCase() : 'P'}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{studentName}</h3>
                  <p className="text-xs text-amber-200 font-medium">
                    NEET 2026 Registered Aspirant{profile?.memberCode ? ` • Member ID: ${profile.memberCode}` : ""}
                  </p>
                  <div className="inline-flex items-center gap-1.5 bg-[#FCB824]/20 text-[#FCB824] text-[10px] font-bold px-2.5 py-0.5 rounded-full mt-1.5 border border-[#FCB824]/30">
                    <span className="w-2 h-2 rounded-full bg-[#FCB824] animate-pulse"></span>
                    <span>{t("Verified Student")}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Form & Info Content */}
            <form onSubmit={handleSaveProfile} className="p-6 space-y-5">
              
              {profileSuccessMsg && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
                  <span>{profileSuccessMsg}</span>
                </div>
              )}


              {/* Package Details */}
              <div className="bg-[#FCB824]/10 dark:bg-amber-950/30 border border-[#FCB824]/30 rounded-2xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-black text-[#00243B] dark:text-white uppercase tracking-wider">Current Package</span>
                  <span className="bg-[#FCB824] text-[#00243B] text-[9px] font-black uppercase px-2 py-0.5 rounded-full">{t("Active")}</span>
                </div>
                <div className="flex justify-between items-end">
                  <div>
                    <h4 className="text-base font-black text-[#00243B] dark:text-[#FCB824]">Achiever Pro Plan</h4>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{t("Valid till May 2026")}</p>
                  </div>
                  <button type="button" onClick={() => setShowProfileModal(false)} className="text-[10px] font-bold text-[var(--teal)] dark:text-[#FCB824] hover:underline cursor-pointer">View Features</button>
                </div>
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aspirant Name</label>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Target Exam")}</label>
                  <select
                    value={targetExam}
                    onChange={(e) => setTargetExam(e.target.value as "" | "NEET" | "JEE")}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                  >
                    <option value="NEET">NEET</option>
                    <option value="JEE">JEE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mobile Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#00243B] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">save</span>
                  Save Changes
                </button>
              </div>

            </form>

          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* ACCOUNT SETTINGS MODAL                                              */}
      {/* ------------------------------------------------------------------ */}
      {showSettingsModal && (
        <Modal onClose={() => setShowSettingsModal(false)} backdropClassName="bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[32px] max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative flex flex-col md:flex-row min-h-[480px]">
            
            {/* Close button */}
            <button
              onClick={() => setShowSettingsModal(false)}
              className="absolute top-4 right-4 z-10 p-2 text-slate-400 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl font-bold">close</span>
            </button>

            {/* Left Sidebar Menu */}
            <div className="w-full md:w-56 bg-slate-50 dark:bg-slate-900/40 p-6 border-r border-slate-200 dark:border-slate-700 flex-shrink-0">
              <h3 className="text-sm font-black text-[var(--navy)] dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[var(--teal)] dark:text-[#FCB824]">settings</span>
                Account Settings
              </h3>

              <div className="space-y-1">
                {[
                  { id: "security", label: "Security & Login", icon: "lock" },
                  { id: "notifications", label: "Notifications", icon: "notifications" },
                  { id: "appearance", label: "Display & Theme", icon: "palette" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSettingsTab(item.id as any)}
                    className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-left transition-all cursor-pointer ${
                      settingsTab === item.id
                        ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-[#00243B] hover:text-[#00243B] dark:hover:text-white"
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{item.icon}</span>
                    <span>{t(item.label)}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Form Content */}
            <form onSubmit={handleSaveSettings} className="flex-1 p-6 flex flex-col justify-between bg-white dark:bg-[var(--navy)]">
              
              <div>
                {settingsSuccessMsg && (
                  <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-bold rounded-xl flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
                    <span>{settingsSuccessMsg}</span>
                  </div>
                )}

                {/* Tab 1: Security & Login */}
                {settingsTab === "security" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-sm font-bold text-[#00243B] dark:text-white">{t("Security & Credentials")}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Manage your portal access password and authentication security</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Current Password")}</label>
                        <input
                          type="password"
                          placeholder="••••••••"
                          value={currPassword}
                          onChange={(e) => setCurrPassword(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("New Password")}</label>
                        <input
                          type="password"
                          placeholder="Enter new strong password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>

                      <div className="pt-2 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-xs font-bold text-[#00243B] dark:text-white">{t("Two-Factor Authentication (2FA)")}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{t("Verify OTP on new browser logins")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setTwoFactor(!twoFactor)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            twoFactor ? "bg-[var(--teal)] dark:bg-[#FCB824]" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        >
                          <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                            twoFactor ? "left-6" : "left-1"
                          }`} />
                        </button>
                      </div>

                      <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider mb-2">{t("Danger Zone")}</p>
                        <button
                          type="button"
                          onClick={() => {
                            setShowSettingsModal(false);
                            setShowDeleteAccountModal(true);
                          }}
                          className="w-full flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-2xl hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer text-left"
                        >
                          <div>
                            <p className="text-xs font-bold text-red-600 dark:text-red-400">{t("Delete Account")}</p>
                            <p className="text-[10px] text-red-500/80 dark:text-red-400/70 font-medium">{t("Permanently delete your account and data")}</p>
                          </div>
                          <span className="material-symbols-outlined text-red-500 text-lg">delete_forever</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 2: Notifications */}
                {settingsTab === "notifications" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-sm font-bold text-[#00243B] dark:text-white">{t("Notification Preferences")}</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t("Choose how and when to receive performance updates")}</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-xs font-bold text-[#00243B] dark:text-white">{t("Email AIR Diagnostic Cards")}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{t("Send detailed score reports to parent/student email")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEmailDiagnosticReports(!emailDiagnosticReports)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            emailDiagnosticReports ? "bg-[var(--teal)] dark:bg-[#FCB824]" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        >
                          <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                            emailDiagnosticReports ? "left-6" : "left-1"
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-xs font-bold text-[#00243B] dark:text-white">{t("Daily Revision Reminders")}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{t("Daily push notifications for weak NCERT topics")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDailyReminders(!dailyReminders)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            dailyReminders ? "bg-[var(--teal)] dark:bg-[#FCB824]" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        >
                          <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                            dailyReminders ? "left-6" : "left-1"
                          }`} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700">
                        <div>
                          <p className="text-xs font-bold text-[#00243B] dark:text-white">{t("WhatsApp Result Alerts")}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{t("Instant WhatsApp summary after test completion")}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWhatsappUpdates(!whatsappUpdates)}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                            whatsappUpdates ? "bg-[var(--teal)] dark:bg-[#FCB824]" : "bg-slate-300 dark:bg-slate-700"
                          }`}
                        >
                          <span className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${
                            whatsappUpdates ? "left-6" : "left-1"
                          }`} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tab 4: Display & Appearance */}
                {settingsTab === "appearance" && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <h4 className="text-sm font-bold text-[#00243B] dark:text-white">Display & Exam UI Customization</h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Adjust contrast and font sizes for test readability</p>
                    </div>

                    <div className="space-y-3 pt-2">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <p className="text-xs font-bold text-[#00243B] dark:text-white">{t("NTA Exam Palette Mode")}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{t("Light & Dark theme optimized for 3-hour exam sessions to minimize eye strain.")}</p>
                        <span className="inline-block px-3 py-1 bg-[var(--teal)]/10 dark:bg-[#FCB824]/20 text-[var(--teal)] dark:text-[#FCB824] font-bold text-[10px] rounded-lg border border-[var(--teal)]/30 dark:border-[#FCB824]/30">{t("Active: High-Contrast Exam Mode")}</span>
                      </div>
                    </div>
                  </div>
                )}

              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 mt-6">
                <button
                  type="button"
                  onClick={() => setShowSettingsModal(false)}
                  className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#00243B] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >{t("Cancel")}</button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-sm">check</span>{t("Save Preferences")}</button>
              </div>

            </form>

          </div>
        </Modal>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DELETE ACCOUNT MODAL (OTP-gated)                                   */}
      {/* ------------------------------------------------------------------ */}
      {showDeleteAccountModal && (
        <Modal onClose={resetDeleteFlow} backdropClassName="bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[32px] max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden relative p-6">
            <button
              onClick={resetDeleteFlow}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>

            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-red-500 text-2xl">delete_forever</span>
            </div>

            {deleteStep === "warn" ? (
              <>
                <h3 className="text-lg font-black text-[#00243B] dark:text-white mb-2">{t("Delete your account?")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4 leading-relaxed">
                  {t("This permanently deletes your profile, study progress and notifications. This cannot be undone. We'll email a verification code to")} <span className="font-bold text-[#00243B] dark:text-white">{profile?.email}</span> {t("to confirm it's really you.")}
                </p>
                {deleteError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold rounded-xl">
                    {deleteError}
                  </div>
                )}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetDeleteFlow}
                    className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#00243B] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >{t("Cancel")}</button>
                  <button
                    type="button"
                    disabled={deleteLoading}
                    onClick={handleSendDeleteOtp}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
                  >{deleteLoading ? t("Sending...") : t("Send Verification Code")}</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-black text-[#00243B] dark:text-white mb-2">{t("Enter verification code")}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-4 leading-relaxed">
                  {deleteOtpSent && t("We've sent a 6-digit code to")} <span className="font-bold text-[#00243B] dark:text-white">{profile?.email}</span>. {t("Enter it below to permanently delete your account.")}
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={deleteOtpCode}
                  onChange={(e) => setDeleteOtpCode(e.target.value.replace(/\D/g, ""))}
                  className="w-full px-4 py-3 mb-4 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-center text-lg font-black tracking-[0.3em] text-[#00243B] dark:text-white focus:border-red-500 outline-none"
                />
                {deleteError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold rounded-xl">
                    {deleteError}
                  </div>
                )}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={resetDeleteFlow}
                    className="px-5 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#00243B] text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >{t("Cancel")}</button>
                  <button
                    type="button"
                    disabled={deleteLoading || deleteOtpCode.trim().length === 0}
                    onClick={handleConfirmDeleteAccount}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
                  >{deleteLoading ? t("Deleting...") : t("Permanently Delete")}</button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
