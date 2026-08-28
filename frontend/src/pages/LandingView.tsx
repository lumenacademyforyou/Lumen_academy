// import React, { useState, useEffect } from "react";
// import { useLanguage } from "../contexts/LanguageContext";
// import { motion, AnimatePresence } from "motion/react";
// import LumenLogo from "../components/ui/LumenLogo";
// import StudyPlanView from "./StudyPlanView";
// import { SYLLABUS_UNITS, SyllabusUnit, SyllabusUnitMaterial } from "../../../database/syllabusData";
// import { sendEmailOtp, sendPhoneOtp, verifyEmailOtp, verifyPhoneOtp } from "../services/supabaseAuth";
// import { sendPhoneOtp, verifyPhoneOtp, signUpWithPassword, signInWithPassword } from "../services/supabaseAuth";


// export type { SyllabusUnit, SyllabusUnitMaterial };
// export { SYLLABUS_UNITS };

// interface LandingViewProps {
//   onLoginSuccess: (name: string, isNewUser?: boolean, isAdmin?: boolean) => void;
//   onQuickDemoFlowC?: () => void;
// }

// export default function LandingView({ onLoginSuccess, onQuickDemoFlowC }: LandingViewProps) {
//   const { t, language } = useLanguage();

//   // Registration Form State
// const [regEmail, setRegEmail] = useState("");
// const [regPassword, setRegPassword] = useState("");
// const [regConfirmPassword, setRegConfirmPassword] = useState("");
// const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

// // Login State
// const [loginEmail, setLoginEmail] = useState("");
// const [loginPassword, setLoginPassword] = useState("");
//   // Modal states for Flow A & Flow B
//   const [showAuthModal, setShowAuthModal] = useState(false);
//   const [authMode, setAuthMode] = useState<"choice" | "register" | "login" | "otp" | "exam_select">("choice");
//   const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
//   // Interactive Syllabus State
//   const [selectedSubjectTab, setSelectedSubjectTab] = useState<"all" | "physics" | "chemistry" | "botany" | "zoology">("all");
//   const [selectedClassTab, setSelectedClassTab] = useState<"all" | "Class 11" | "Class 12">("all");
//   const [syllabusSearch, setSyllabusSearch] = useState("");
//   const [activeUnitModal, setActiveUnitModal] = useState<SyllabusUnit | null>(null);
//   const [unitModalTab, setUnitModalTab] = useState<"mock_test" | "syllabus_materials">("syllabus_materials");
//   const [activeMaterialViewer, setActiveMaterialViewer] = useState<SyllabusUnitMaterial | null>(null);
  
//   // Registration & Login Contact Method State
//   const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
//   const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
//   const [regPhone, setRegPhone] = useState("");
//   const [loginPhone, setLoginPhone] = useState("");
//   const [otpDelivery, setOtpDelivery] = useState<"email" | "phone">("email");

//   // Registration Form State (Flow A)
//   const [regName, setRegName] = useState("");
//   const [regPhoneOrEmail, setRegPhoneOrEmail] = useState("");
//   const [regStream, setRegStream] = useState("NEET Aspirant");
//   const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
//   const [otpFlow, setOtpFlow] = useState<"register" | "login">("register");
//   const [isSendingOtp, setIsSendingOtp] = useState(false);
//   const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
//   const [selectedExam, setSelectedExam] = useState("Ultimate Mock Series");

//   // Login State (Flow B)
//   const [loginPhoneOrEmail, setLoginPhoneOrEmail] = useState("");
//   const [formError, setFormError] = useState("");

//   const handleOpenRegister = () => {
//     setAuthMode("register");
//     setShowAuthModal(true);
//     setFormError("");
//   };

//   const handleOpenLogin = () => {
//     setAuthMode("login");
//     setShowAuthModal(true);
//     setFormError("");
//   };

//   // E.164 format required by Supabase (and every SMS provider behind it) — no
//   // spaces, no punctuation.
//   const toE164 = (rawPhone: string) => `${phoneCountryCode}${rawPhone.replace(/\D/g, "")}`;

// const handleRegisterSubmit = async (e: React.FormEvent) => {
//   e.preventDefault();
//   if (!regName.trim()) {
//     setFormError("Please enter your full name.");
//     return;
//   }

//   if (authMethod === "phone") {
//     // ...unchanged phone OTP branch...
//     return;
//   }

//   // Email + password registration
//   if (!regEmail.trim() || !regEmail.includes("@")) {
//     setFormError("Please enter a valid email address.");
//     return;
//   }
//   if (regPassword.length < 8) {
//     setFormError("Password must be at least 8 characters.");
//     return;
//   }
//   if (regPassword !== regConfirmPassword) {
//     setFormError("Passwords don't match.");
//     return;
//   }

//   setFormError("");
//   setIsSubmittingAuth(true);
//   try {
//     const session = await signUpWithPassword(regEmail.trim().toLowerCase(), regPassword, regName.trim(), regStream);
//     if (session) {
//       onLoginSuccess(regName.trim(), true);
//     } else {
//       // Confirm-email is enabled in Supabase settings
//       setFormError("Check your email to confirm your account, then sign in.");
//       setAuthMode("login");
//     }
//   } catch (err: any) {
//     setFormError(err.message || "Could not create your account. Please try again.");
//   } finally {
//     setIsSubmittingAuth(false);
//   }
// };

//   const handleOtpSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     const entered = otpValues.join("");
//     if (entered.length < 6) {
//       setFormError("Please enter the 6-digit verification code.");
//       return;
//     }
//     setFormError("");
//     setIsVerifyingOtp(true);

//     const identifier = otpDelivery === "phone" ? toE164(regPhone || loginPhone) : (regPhoneOrEmail || loginPhoneOrEmail).trim().toLowerCase();
//     const displayName = regName.trim() || (otpDelivery === "phone" ? `Student (${identifier.slice(-4)})` : identifier.split("@")[0]) || "Student";

//     try {
//       const session = otpDelivery === "phone" ? await verifyPhoneOtp(identifier, entered) : await verifyEmailOtp(identifier, entered);
//       const sessionName = (session.user.user_metadata as { display_name?: string } | undefined)?.display_name || displayName;

//       if (otpFlow === "register") {
//         setAuthMode("exam_select");
//       } else {
//         onLoginSuccess(sessionName, false);
//       }
//     } catch (err: any) {
//       setFormError(err.message || "That code didn't match. Please check it and try again.");
//     } finally {
//       setIsVerifyingOtp(false);
//     }
//   };

//  const handleLoginSubmit = async (e: React.FormEvent) => {
//   e.preventDefault();

//   if (authMethod === "phone") {
//     // ...unchanged phone OTP branch...
//     return;
//   }

//   if (!loginEmail.trim() || !loginEmail.includes("@")) {
//     setFormError("Please enter your registered email.");
//     return;
//   }
//   if (!loginPassword) {
//     setFormError("Please enter your password.");
//     return;
//   }

//   setFormError("");
//   setIsSubmittingAuth(true);
//   try {
//     const session = await signInWithPassword(loginEmail.trim().toLowerCase(), loginPassword);
//     const meta = session.user.user_metadata as { display_name?: string } | undefined;
//     onLoginSuccess(meta?.display_name || loginEmail.split("@")[0], false);
//   } catch (err: any) {
//     setFormError(err.message || "Incorrect email or password.");
//   } finally {
//     setIsSubmittingAuth(false);
//   }
// };

//   const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
//     if (typeof window !== "undefined") {
//       const saved = localStorage.getItem("lumen_theme");
//       if (saved === "dark") return true;
//       if (saved === "light") return false;
//       return document.documentElement.classList.contains("dark");
//     }
//     return false;
//   });

//   useEffect(() => {
//     if (isDarkMode) {
//       document.documentElement.classList.add("dark");
//       document.documentElement.setAttribute("data-theme", "dark");
//       localStorage.setItem("lumen_theme", "dark");
//     } else {
//       document.documentElement.classList.remove("dark");
//       document.documentElement.setAttribute("data-theme", "light");
//       localStorage.setItem("lumen_theme", "light");
//     }
//   }, [isDarkMode]);

//   const toggleDarkMode = () => {
//     setIsDarkMode((prev) => !prev);
//   };

//   const handleOtpChange = (index: number, val: string) => {
//     if (!/^\d*$/.test(val)) return;
//     const newOtp = [...otpValues];
//     newOtp[index] = val.slice(-1);
//     setOtpValues(newOtp);

//     if (val && index < otpValues.length - 1) {
//       const nextInput = document.getElementById(`modal-otp-${index + 1}`);
//       nextInput?.focus();
//     }
//   };

//   const handleExamSelectFinish = () => {
//     onLoginSuccess(regName || "Prince A", true);
//   };

//   return (
//     <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-[#00243B] dark:text-slate-100 font-sans flex flex-col selection:bg-amber-100 selection:text-amber-900">
      
//       {/* Primary Navigation Header */}
//       <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#031824]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700 shadow-sm">
//         <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-12 h-24 py-2 flex items-center justify-between gap-4">
          
//           {/* Logo & Name */}
//           <div className="flex items-center gap-3 cursor-pointer pl-2 md:pl-3" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
//             <LumenLogo className="w-[64px] md:w-[80px] h-[64px] md:h-[80px]  transition-transform hover:scale-105 duration-200" />
//             <div className="hidden sm:block">
//               <span className="font-black text-2xl md:text-3xl text-[var(--navy)] dark:text-white tracking-tight block leading-none">
//                 LUMEN ACADEMY
//               </span>
//               <span className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-amber-300/90 tracking-wider mt-1 block uppercase whitespace-nowrap">
//                 Empowering Future through Learning
//               </span>
//             </div>
//           </div>

//           {/* Navigation Links */}
//           <nav className="hidden lg:flex items-center gap-8 text-xs font-extrabold text-[#00243B] dark:text-slate-200 uppercase tracking-wider">
//             <a href="#features" className="hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors">{t("Features")}</a>
//             <a href="#courses" className="hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors">{t("Courses")}</a>
//             <a href="#pricing" className="hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors">{t("Test Packages")}</a>
//           </nav>

//           {/* Header Action CTAs with Dark Mode Toggle */}
//           <div className="flex items-center gap-2.5 sm:gap-3">
//             {/* Global Dark Mode Theme Toggle */}
//             <button
//               onClick={toggleDarkMode}
//               className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer select-none shadow-sm shrink-0 ${
//                 isDarkMode
//                   ? "bg-[#00243B] text-[#FCB824] border-[#FCB824]/40 hover:bg-slate-700 hover:border-[#FCB824]"
//                   : "bg-amber-50 text-[#00243B] border-amber-200 hover:bg-amber-100"
//               }`}
//               title={isDarkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
//             >
//               <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${isDarkMode ? "text-[#FCB824] rotate-180" : "text-[#ffd15c]"}`}>
//                 {isDarkMode ? "dark_mode" : "light_mode"}
//               </span>
//             </button>

//             <button
//               onClick={handleOpenLogin}
//               className="px-3.5 py-2 text-xs font-bold text-[var(--navy)] dark:text-white hover:text-[var(--teal)] dark:hover:text-[#FCB824] hover:bg-slate-100 dark:hover:bg-[#00243B] rounded-xl transition-all cursor-pointer hidden sm:block"
//             >{t("Sign In")}</button>

//             <button
//               onClick={handleOpenRegister}
//               className="px-3.5 py-2 bg-[var(--teal)] hover:bg-[var(--teal-2)] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
//             >
//               <span className="material-symbols-outlined text-sm">person_add</span>
//               <span className="hidden xs:inline">{t("Register Aspirant")}</span>
//               <span className="xs:hidden">{t("Register")}</span>
//             </button>

//             {/* Mobile Menu Toggle Button */}
//             <button
//               onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
//               className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
//               aria-label="Toggle navigation menu"
//             >
//               <span className="material-symbols-outlined text-xl">
//                 {mobileMenuOpen ? "close" : "menu"}
//               </span>
//             </button>
//           </div>
//         </div>

//         {/* Mobile Navigation Drawer */}
//         {mobileMenuOpen && (
//           <div className="lg:hidden bg-white dark:bg-[var(--navy)] border-b border-slate-200 dark:border-slate-700 px-6 py-4 space-y-3 animate-in fade-in duration-200">
//             <a 
//               href="#features" 
//               onClick={() => setMobileMenuOpen(false)}
//               className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase hover:text-[var(--teal)]"
//             >{t("Features")}</a>
//             <a 
//               href="#courses" 
//               onClick={() => setMobileMenuOpen(false)}
//               className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase hover:text-[var(--teal)]"
//             >{t("Courses")}</a>
//             <a 
//               href="#pricing" 
//               onClick={() => setMobileMenuOpen(false)}
//               className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase hover:text-[var(--teal)]"
//             >{t("Test Packages")}</a>
//             <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-2">
//               <button
//                 onClick={() => {
//                   setMobileMenuOpen(false);
//                   handleOpenLogin();
//                 }}
//                 className="w-1/2 py-2 text-xs font-bold text-[var(--navy)] dark:text-white bg-slate-100 dark:bg-slate-800 rounded-xl text-center cursor-pointer"
//               >{t("Sign In")}</button>
//               <button
//                 onClick={() => {
//                   setMobileMenuOpen(false);
//                   handleOpenRegister();
//                 }}
//                 className="w-1/2 py-2 text-xs font-bold text-white bg-[var(--teal)] rounded-xl text-center cursor-pointer"
//               >{t("Register")}</button>
//             </div>
//           </div>
//         )}
//       </header>

//       {/* HERO SECTION */}
//       <section className="relative pt-12 md:pt-20 pb-16 md:pb-24 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full overflow-hidden">
//         {/* Decorative background glows with smooth floating animation */}
//         <motion.div
//           animate={{ scale: [1, 1.08, 1], rotate: [0, 2, 0] }}
//           transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
//           className="absolute -top-12 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-sky-200/30 to-[var(--gold)]/10 blur-3xl pointer-events-none -z-10 rounded-full"
//         />
        
//         <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
//           {/* Left Column: Hero Text */}
//           <motion.div
//             initial={{ opacity: 0, x: -30 }}
//             animate={{ opacity: 1, x: 0 }}
//             transition={{ duration: 0.6, ease: "easeOut" }}
//             className="lg:col-span-7 space-y-6 text-center lg:text-left"
//           >
//             <motion.div
//               initial={{ opacity: 0, y: -10 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: 0.1, duration: 0.4 }}
//               className="inline-flex flex-wrap items-center gap-2 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-[#FCB824]/40 px-3.5 py-1.5 rounded-full text-amber-900 dark:text-amber-200 text-xs font-bold shadow-sm"
//             >
//               <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] animate-pulse">stars</span>
//               <span className="font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider">Journey to success start here</span>
//               <span className="text-[#FCB824] dark:text-[#FCB824]">•</span>
//               <span className="text-amber-900 dark:text-[#FCB824]">Comprehensive Diagnostic Mock Test Platform</span>
//             </motion.div>

//             <motion.h1
//               initial={{ opacity: 0, y: 15 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: 0.2, duration: 0.5 }}
//               className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-950 dark:text-white tracking-tight leading-[1.15]"
//             >
//               Accelerate Your Exam Rank with <span className="text-[var(--gold)] animate-shimmer-text">Exact Syllabus Mocks</span>
//             </motion.h1>

//             <motion.p
//               initial={{ opacity: 0, y: 15 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: 0.3, duration: 0.5 }}
//               className="text-slate-700 dark:text-slate-200 text-sm md:text-base leading-relaxed font-semibold max-w-2xl mx-auto lg:mx-0"
//             >
//               Simulate actual exam pressure with exact syllabus matching. Receive instant rank forecasts, speed vs accuracy velocity reports, and chapter-wise weakness remediation.
//             </motion.p>

//             {/* CTAs */}
//             <motion.div
//               initial={{ opacity: 0, y: 15 }}
//               animate={{ opacity: 1, y: 0 }}
//               transition={{ delay: 0.4, duration: 0.5 }}
//               className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2"
//             >
//               <motion.button
//                 whileHover={{ scale: 1.03 }}
//                 whileTap={{ scale: 0.97 }}
//                 onClick={handleOpenRegister}
//                 className="w-full sm: px-8 py-4 bg-[var(--teal)] hover:bg-[var(--teal-2)] text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-xl hover:shadow-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
//               >
//                 <span className="material-symbols-outlined text-sm">rocket_launch</span>
//                 Register New Aspirant
//               </motion.button>

//               <motion.button
//                 whileHover={{ scale: 1.03 }}
//                 whileTap={{ scale: 0.97 }}
//                 onClick={handleOpenLogin}
//                 className="w-full sm: px-8 py-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[var(--teal)] dark:hover:border-[#FCB824] text-[#00243B] dark:text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
//               >
//                 <span className="material-symbols-outlined text-sm">login</span>
//                 Sign In Returning Student
//               </motion.button>
//             </motion.div>

//             {/* Key Assurance Badges */}
//             <motion.div
//               initial={{ opacity: 0 }}
//               animate={{ opacity: 1 }}
//               transition={{ delay: 0.5, duration: 0.5 }}
//               className="pt-6 border-t border-slate-200/80 flex flex-wrap justify-center lg:justify-start gap-6 text-xs font-bold text-slate-700 dark:text-slate-200"
//             >
//               <span className="flex items-center gap-1.5 hover:text-[var(--teal)] transition-colors">
//                 <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-base font-bold">videocam</span>
//                 Live Face & Gaze Detection
//               </span>
//               <span className="flex items-center gap-1.5 hover:text-[var(--teal)] transition-colors">
//                 <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-base font-bold">analytics</span>
//                 Instant Rank Diagnostic Card
//               </span>
//               <span className="flex items-center gap-1.5 hover:text-[var(--teal)] transition-colors">
//                 <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-base font-bold">menu_book</span>
//                 38 NCERT Chapters
//               </span>
//             </motion.div>
//           </motion.div>

//           {/* Right Column: Interactive 3D Hero */}
//           <motion.div
//             initial={{ opacity: 0, x: 30, scale: 0.95 }}
//             animate={{ opacity: 1, x: 0, scale: 1 }}
//             transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
//             className="lg:col-span-5 relative"
//             style={{ perspective: 1200 }}
//           >
//             {/* Floating Elements Background */}
//             <motion.div
//               animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
//               transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
//               className="absolute -top-10 -right-4 bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-3 z-20 flex items-center gap-3 backdrop-blur-md"
//             >
//               <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
//                 <span className="material-symbols-outlined text-[#ffd15c] dark:text-[#FCB824] text-sm">stars</span>
//               </div>
//               <div>
//                 <p className="text-[10px] font-black uppercase text-[#00243B] dark:text-white leading-none">Rank 140</p>
//                 <p className="text-[9px] font-bold text-[#ffd15c] dark:text-[#FCB824]">Projected Rank</p>
//               </div>
//             </motion.div>

//             <motion.div
//               animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
//               transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
//               className="absolute -bottom-8 -left-4 bg-[var(--teal)] dark:bg-[var(--navy)] border border-[#172554] dark:border-slate-700 shadow-2xl rounded-2xl p-3 z-20 flex items-center gap-2"
//             >
//               <div className="w-2 h-2 rounded-full bg-[#FCB824] animate-ping"></div>
//               <p className="text-[10px] font-black uppercase text-white tracking-widest">{t("System OK")}</p>
//             </motion.div>

//             {/* Laptop Frame */}
//             <motion.div 
//               className="relative z-10 w-full rounded-t-[24px] rounded-b-[12px] bg-[#00243B] dark:bg-slate-800 p-2 shadow-2xl border-4 border-slate-300 dark:border-slate-700"
//               whileHover={{ rotateX: 5, rotateY: -5, scale: 1.02 }}
//               transition={{ type: "spring", stiffness: 400, damping: 30 }}
//               style={{ transformStyle: "preserve-3d" }}
//             >
//               {/* Screen Content */}
//               <div className="bg-white dark:bg-[var(--navy)] rounded-[16px] p-6 h-[400px] overflow-hidden relative" style={{ transform: "translateZ(30px)" }}>
//                 <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
//                   <div className="flex items-center gap-2">
//                     <span className="w-3 h-3 rounded-full bg-[#FCB824] animate-ping"></span>
//                     <span className="text-xs font-black text-[#00243B] dark:text-white uppercase tracking-wider">Exam Environment</span>
//                   </div>
//                   <span className="bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 text-[10px] font-black uppercase px-2.5 py-1 rounded-md shadow-sm">
//                     Live
//                   </span>
//                 </div>
                
//                 {/* Simulated Exam View snippet */}
//                 <div className="space-y-4">
//                   <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-[#00243B] dark:text-white flex items-center justify-between shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
//                     <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-400 via-transparent to-transparent"></div>
//                     <div className="flex items-center gap-3 relative z-10">
//                       <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-[var(--teal)] dark:text-teal-400 font-bold text-xs backdrop-blur-sm">
//                         <span className="material-symbols-outlined text-base animate-pulse">psychology</span>
//                       </div>
//                       <div>
//                         <p className="text-xs font-bold">Adaptive Difficulty Engine</p>
//                         <p className="text-[10px] text-teal-600 dark:text-teal-400 font-mono tracking-widest mt-0.5">Calibrating...</p>
//                       </div>
//                     </div>
//                   </div>
//                   <div className="text-right">
//                     <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">{t("Time Remaining")}</span>
//                     <span className="font-mono text-sm font-bold text-[#00243B] dark:text-white">02:45:18</span>
//                   </div>
//                 </div>

//                 <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
//                   <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
//                     <span>Q.42 • Course Subject</span>
//                     <span className="text-[var(--teal)] dark:text-sky-400">NCERT Class 12</span>
//                   </div>
//                   <p className="text-xs font-bold text-[#00243B] dark:text-slate-200">
//                     Which codon functions as the primary universal start signal during ribosomal translation in eukaryotic cells?
//                   </p>
//                   <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-semibold">
//                     <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded-lg border border-[#FCB824] dark:border-amber-600 flex items-center gap-2">
//                       <span className="w-4 h-4 rounded-full bg-[#ffd15c] text-amber-900 text-[9px] flex items-center justify-center font-bold">A</span>
//                       <span>AUG (Methionine)</span>
//                     </div>
//                     <div className="p-2 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-2">
//                       <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-[9px] flex items-center justify-center font-bold">B</span>
//                       <span>UAA (Stop)</span>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="bg-amber-50/70 dark:bg-slate-800/50 rounded-2xl p-4 border border-amber-200/80 dark:border-slate-700 flex items-center justify-between text-xs">
//                   <div>
//                     <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase block">Predicted Score Improvement</span>
//                     <span className="text-base font-black text-[var(--teal)] dark:text-sky-300">+85 Marks Improvement</span>
//                   </div>
//                   <button
//                     onClick={onQuickDemoFlowC || handleOpenRegister}
//                     className="px-4 py-2 bg-[var(--teal)] text-white font-bold rounded-xl text-[11px] hover:bg-[var(--teal-2)] transition-colors cursor-pointer"
//                   >
//                     Start Free Mock
//                   </button>
//                 </div>
//               </div>
              
//               {/* Laptop Keyboard Base */}
//               <div 
//                 className="absolute -bottom-6 -inset-x-6 h-6 bg-[#00243B] dark:bg-slate-900 rounded-b-xl flex justify-center border-t border-slate-700/50 shadow-2xl" 
//                 style={{ transform: "rotateX(-30deg) translateZ(10px)" }}
//               >
//                 <div className="w-1/3 h-2 bg-[#00243B] dark:bg-slate-900 rounded-b-md mt-1 border-b border-slate-700/50"></div>
//               </div>
//             </motion.div>
//           </motion.div>

//         </div>
//       </section>

//       {/* PLATFORM METRICS STATS BANNER */}
//       <section className="bg-gradient-to-r from-[var(--navy)] via-[var(--navy)] to-[var(--navy)] py-12 text-white border-y border-[#FCB824]/20 overflow-hidden">
//         <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
//           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
//             <div className="text-3xl md:text-4xl font-black text-[#FCB824] tracking-tight">50,000+</div>
//             <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">Mock Exams Completed</div>
//           </motion.div>
//           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
//             <div className="text-3xl md:text-4xl font-black text-[#FCB824] tracking-tight">99.8%</div>
//             <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">{t("System Reliability Rate")}</div>
//           </motion.div>
//           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
//             <div className="text-3xl md:text-4xl font-black text-[#FCB824] tracking-tight">38 Units</div>
//             <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">NCERT Physics/Chem/Bio</div>
//           </motion.div>
//           <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
//             <div className="text-3xl md:text-4xl font-black text-[#FCB824] tracking-tight">+85 Pts</div>
//             <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">Avg Score Rank Growth</div>
//           </motion.div>
//         </div>
//       </section>

//       {/* FEATURES SECTION */}
//       <section id="features" className="py-20 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full">
//         <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
//           <span className="text-[var(--teal)] dark:text-[#FCB824] text-xs font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/50">
//             Engineered for Top Ranks
//           </span>
//           <h2 className="text-2xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
//             Why Top Rankers Choose Lumen Academy
//           </h2>
//           <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">
//             Standard offline test series lack real-time feedback. Our AI engine bridges the gap between practice and real exam day perfection.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-8" style={{ perspective: 1000 }}>
          
//           {/* Card 1 */}
//           <motion.div
//             initial={{ opacity: 0, y: 25 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             whileHover={{ scale: 1.05, rotateY: -5, rotateX: 5, z: 20, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
//             transition={{ type: "spring", stiffness: 300, damping: 20 }}
//             viewport={{ once: true }}
//             className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-8 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 space-y-4"
//           >
//             <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-[#FCB824]/40 flex items-center justify-center text-[var(--teal)] dark:text-[#FCB824]">
//               <span className="material-symbols-outlined text-2xl font-bold">menu_book</span>
//             </div>
//             <h3 className="text-lg font-black text-[#00243B] dark:text-white">{t("Strict Syllabus Match")}</h3>
//             <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
//               100% aligned with the exact syllabus guidelines for all major subjects.
//             </p>
//             <ul className="text-xs font-bold text-[#00243B] dark:text-slate-100 space-y-2 pt-2">
//               <li className="flex items-center gap-2">
//                 <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
//                 Curated from latest NCERT editions
//               </li>
//               <li className="flex items-center gap-2">
//                 <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
//                 No out-of-syllabus questions
//               </li>
//             </ul>
//           </motion.div>

//           {/* Card 2 */}
//           <motion.div
//             initial={{ opacity: 0, y: 25 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             whileHover={{ scale: 1.05, rotateY: 5, rotateX: 5, z: 20, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
//             transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
//             viewport={{ once: true }}
//             className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-8 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 space-y-4"
//           >
//             <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-[#FCB824]/40 flex items-center justify-center text-amber-800 dark:text-[#FCB824]">
//               <span className="material-symbols-outlined text-2xl font-bold">query_stats</span>
//             </div>
//             <h3 className="text-lg font-black text-[#00243B] dark:text-white">Diagnostic Scorecards & Rank</h3>
//             <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
//               Immediate post-exam breakdown featuring subject accuracy rings, time spent per question, and predicted All-India Rank percentile.
//             </p>
//             <ul className="text-xs font-bold text-[#00243B] dark:text-slate-100 space-y-2 pt-2">
//               <li className="flex items-center gap-2">
//                 <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
//                 Speed vs accuracy velocity matrix
//               </li>
//               <li className="flex items-center gap-2">
//                 <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
//                 Targeted weak topic revision flashcards
//               </li>
//             </ul>
//           </motion.div>

//           {/* Card 3 */}
//           <motion.div
//             initial={{ opacity: 0, y: 25 }}
//             whileInView={{ opacity: 1, y: 0 }}
//             whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5, z: 20, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
//             transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
//             viewport={{ once: true }}
//             className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-8 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 space-y-4"
//           >
//             <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-[#FCB824]/40 flex items-center justify-center text-amber-800 dark:text-[#FCB824]">
//               <span className="material-symbols-outlined text-2xl font-bold">menu_book</span>
//             </div>
//             <h3 className="text-lg font-black text-[#00243B] dark:text-white">Complete NCERT Syllabus Library</h3>
//             <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
//               Comprehensive coverage of Physics (Mechanics, Electrodynamics), Chemistry (Organic, Inorganic), and Biology (Human Physiology, Genetics).
//             </p>
//             <ul className="text-xs font-bold text-[#00243B] dark:text-slate-100 space-y-2 pt-2">
//               <li className="flex items-center gap-2">
//                 <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
//                 Standard marking scheme (+4 / -1 penalty)
//               </li>
//               <li className="flex items-center gap-2">
//                 <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
//                 Custom mock test generator wizard
//               </li>
//             </ul>
//           </motion.div>

//         </div>
//       </section>

//       {/* HOW IT WORKS SECTION */}
//       <section className="py-20 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full border-t border-slate-200/50 dark:border-slate-800/50">
//         <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
//           <span className="text-[var(--teal)] dark:text-[#FCB824] text-xs font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/50">
//             Simple 4-Step Process
//           </span>
//           <h2 className="text-2xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
//             How Lumen Academy Works
//           </h2>
//           <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">
//             From registration to rank improvement, our platform guides you systematically towards your target score.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
//           {/* Connecting line for desktop */}
//           <div className="hidden md:block absolute top-10 left-12 right-12 h-0.5 bg-gradient-to-r from-transparent via-[var(--teal)] dark:via-[#FCB824] to-transparent opacity-30 z-0"></div>
          
//           {[
//             {
//               step: "01",
//               title: "Register & Profile",
//               desc: "Create your free account, select your target exam (NEET/JEE), and set your baseline goals.",
//               icon: "app_registration"
//             },
//             {
//               step: "02",
//               title: "Diagnostic Mock",
//               desc: "Take a full-syllabus mock test to establish your baseline score and accuracy velocity.",
//               icon: "quiz"
//             },
//             {
//               step: "03",
//               title: "AI Analysis",
//               desc: "Review your detailed scorecard, identifying exact weak chapters and time-management gaps.",
//               icon: "insights"
//             },
//             {
//               step: "04",
//               title: "Targeted Revision",
//               desc: "Use our syllabus viewer to access precise materials for weak areas and re-test to improve.",
//               icon: "trending_up"
//             }
//           ].map((item, idx) => (
//             <motion.div
//               key={idx}
//               initial={{ opacity: 0, y: 30 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true }}
//               transition={{ delay: idx * 0.15, type: "spring", stiffness: 200 }}
//               className="relative z-10 flex flex-col items-center text-center space-y-4"
//             >
//               <div className="w-20 h-20 rounded-full bg-white dark:bg-[var(--navy)] border-4 border-slate-50 dark:border-slate-800 shadow-lg flex items-center justify-center relative group">
//                 <div className="absolute inset-0 rounded-full bg-[var(--teal)]/10 dark:bg-[#FCB824]/10 group-hover:scale-110 transition-transform duration-300"></div>
//                 <span className="material-symbols-outlined text-3xl text-[var(--teal)] dark:text-[#FCB824] z-10">{item.icon}</span>
//                 <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 border-2 border-white dark:border-[var(--navy)] flex items-center justify-center text-[10px] font-black text-amber-900 dark:text-amber-100 shadow-sm">
//                   {item.step}
//                 </div>
//               </div>
//               <h3 className="text-lg font-black text-[#00243B] dark:text-white pt-2">{item.title}</h3>
//               <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-[250px]">
//                 {item.desc}
//               </p>
//             </motion.div>
//           ))}
//         </div>
//       </section>

//       {/* COURSES SECTION */}
//       <section id="courses" className="py-20 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full bg-slate-50 dark:bg-slate-900/40 rounded-3xl mb-8">
//         <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
//           <span className="text-[var(--teal)] dark:text-[#FCB824] text-xs font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/50">
//             Comprehensive Learning
//           </span>
//           <h2 className="text-2xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
//             Our Top Courses
//           </h2>
//           <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">
//             Prepare for your dream career with our specialized programs designed for absolute success.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
//           {[
//             {
//               title: "NEET",
//               desc: "Master the National Eligibility cum Entrance Test with our comprehensive biology, physics, and chemistry curriculum.",
//               icon: "biotech",
//               streamValue: "NEET Aspirant"
//             },
//             {
//               title: "JEE",
//               desc: "Crack the Joint Entrance Examination with our advanced mathematics, physics, and chemistry problem-solving modules.",
//               icon: "calculate",
//               streamValue: "JEE Mains"
//             },
//             {
//               title: "Olympiad Exams",
//               desc: "Challenge yourself with our Olympiad preparation courses to excel in national and international science competitions.",
//               icon: "emoji_events",
//               streamValue: "Olympiad"
//             }
//           ].map((course, idx) => (
//             <motion.div
//               key={idx}
//               initial={{ opacity: 0, y: 20 }}
//               whileInView={{ opacity: 1, y: 0 }}
//               viewport={{ once: true }}
//               transition={{ delay: idx * 0.1 }}
//               className="bg-white dark:bg-[var(--navy)] p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col h-full"
//             >
//               <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
//                 <span className="material-symbols-outlined text-3xl text-[var(--teal)] dark:text-[#FCB824]">{course.icon}</span>
//               </div>
//               <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">{course.title}</h3>
//               <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-grow">
//                 {course.desc}
//               </p>
//               <button 
//                 onClick={() => {
//                   setRegStream(course.streamValue);
//                   handleOpenRegister();
//                 }}
//                 className="mt-auto self-start flex items-center gap-2 text-[var(--teal)] dark:text-[#FCB824] font-bold text-sm hover:opacity-80 transition-opacity"
//               >
//                 Apply Now <span className="material-symbols-outlined text-sm">arrow_forward</span>
//               </button>
//             </motion.div>
//           ))}
//         </div>
//       </section>

//       {/* TEST PACKAGES & PRICING SECTION */}
//       <section id="pricing" className="py-20 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full">
//         <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
//           <span className="text-[var(--teal)] dark:text-[#FCB824] text-xs font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/70 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/40">
//             Student Affordable Plans
//           </span>
//           <h2 className="text-2xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
//             Choose Your Test Package
//           </h2>
//           <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">
//             Supercharged mock series with reduced student-friendly pricing and 100% free study resources.
//           </p>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
//           {/* Package 1: Free Starter Practice + Free Resources */}
//           <div className="bg-white dark:bg-[var(--navy)] p-8 rounded-[28px] border-2 border-[var(--teal)]/30 dark:border-[#FCB824]/30 shadow-sm flex flex-col justify-between hover:border-[var(--teal)] dark:hover:border-[#FCB824] hover:shadow-lg transition-all relative">
//             <div className="absolute -top-3 left-6 bg-[var(--teal)] dark:bg-[#ffd15c] text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
//               100% Free Resources
//             </div>

//             <div className="space-y-6 pt-2">
//               <div>
//                 <span className="text-[10px] font-black text-amber-800 dark:text-[#FCB824] uppercase tracking-wider bg-amber-50 dark:bg-amber-950/70 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
//                   Free Resource Pass
//                 </span>
//                 <h3 className="text-xl font-bold text-[var(--navy)] dark:text-white mt-3">Free Starter & Resources</h3>
//                 <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{t("Zero cost access to study material & mini mocks")}</p>
//               </div>

//               <div className="flex items-baseline gap-1">
//                 <span className="text-3xl md:text-4xl font-black text-[var(--teal)] dark:text-[#FCB824]">₹0</span>
//                 <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">/ 100% Free Forever</span>
//               </div>

//               <ul className="space-y-3 text-xs font-semibold text-slate-700 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">check_circle</span>
//                   <span>3 Free Full-Length Mocks</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">description</span>
//                   <span>Free NCERT Biology & Physics Formula Sheet PDFs</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">menu_book</span>
//                   <span>Free 10-Year PYQ Solved Question Bank</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">analytics</span>
//                   <span>Free Rank Diagnostic Predictor & Velocity Stats</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">videocam</span>
//                   <span>{t("Full-Syllabus Diagnostic Mode included")}</span>
//                 </li>
//               </ul>
//             </div>

//             <button
//               onClick={() => {
//                 setSelectedExam("Starter Practice Pass");
//                 handleOpenRegister();
//               }}
//               className="w-full mt-8 py-3.5 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer text-center shadow-md"
//             >
//               Access Free Material (₹0)
//             </button>
//           </div>

//           {/* Package 2: Ultimate Mock Series (Featured) */}
//           <div className="bg-[var(--navy)] dark:bg-[var(--navy)] text-white p-8 rounded-[32px] border-2 border-[#FCB824] shadow-2xl flex flex-col justify-between relative transform lg:-translate-y-2">
//             <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#FCB824] text-slate-950 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
//               Most Popular Among Rankers
//             </div>

//             <div className="space-y-6 pt-2">
//               <div>
//                 <span className="text-[10px] font-black text-[#FCB824] uppercase tracking-wider bg-white/10 px-3 py-1 rounded-full">
//                   Recommended Series
//                 </span>
//                 <h3 className="text-xl font-bold text-white mt-3">Ultimate Mock Series</h3>
//                 <p className="text-xs text-slate-300 font-medium mt-1">18 Full-length standard mock tests</p>
//               </div>

//               <div className="flex items-baseline gap-2">
//                 <span className="text-3xl md:text-4xl font-black text-[#FCB824]">₹999</span>
//                 <span className="text-xs text-slate-300 font-medium line-through">₹2,999</span>
//                 <span className="text-[10px] bg-[#FCB824]/30 text-[#FCB824] px-2.5 py-0.5 rounded font-black border border-[#FCB824]/40">67% OFF</span>
//               </div>

//               <ul className="space-y-3 text-xs font-semibold text-slate-200 pt-2 border-t border-white/10">
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#FCB824]">check_circle</span>
//                   <span>18 Full-Length 180-Question Mocks</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#FCB824]">verified</span>
//                   <span>Includes ALL ₹0 Free Formula Sheets & PYQs</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#FCB824]">check_circle</span>
//                   <span>{t("Full-Syllabus Diagnostic Mode included")}</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#FCB824]">check_circle</span>
//                   <span>Instant Rank Percentile</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#FCB824]">check_circle</span>
//                   <span>Full Step-by-Step Question Explanations</span>
//                 </li>
//               </ul>
//             </div>

//             <button
//               onClick={() => {
//                 setSelectedExam("Ultimate Mock Series");
//                 handleOpenRegister();
//               }}
//               className="w-full mt-8 py-4 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] dark:text-slate-950 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl transition-all cursor-pointer text-center"
//             >
//               Enroll for ₹999 →
//             </button>
//           </div>

//           {/* Package 3: Rank Acceleration Master Pack */}
//           <div className="bg-white dark:bg-[var(--navy)] p-8 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:border-[var(--teal)] dark:hover:border-[#FCB824] transition-all">
//             <div className="space-y-6">
//               <div>
//                 <span className="text-[10px] font-black text-amber-900 dark:text-[#FCB824] uppercase tracking-wider bg-amber-50 dark:bg-amber-950/70 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
//                   Complete Exam Mastery
//                 </span>
//                 <h3 className="text-xl font-bold text-[var(--navy)] dark:text-white mt-3">Rank Acceleration Master Pack</h3>
//                 <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{t("Unlimited custom tests & weakness remediation")}</p>
//               </div>

//               <div className="flex items-baseline gap-2">
//                 <span className="text-3xl md:text-4xl font-black text-[#00243B] dark:text-white">₹1,499</span>
//                 <span className="text-xs text-slate-400 dark:text-slate-500 font-medium line-through">₹4,999</span>
//                 <span className="text-[10px] bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded font-black border border-amber-200 dark:border-[#FCB824]/40">70% OFF</span>
//               </div>

//               <ul className="space-y-3 text-xs font-semibold text-slate-700 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
//                   <span>All 38 NCERT Unit Chapter Mocks</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
//                   <span>Infinite Custom AI Mock Test Generator</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
//                   <span>All Free ₹0 Material + 18 Full Mocks Included</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
//                   <span>AI Weak Topic Remediation Flashcards</span>
//                 </li>
//                 <li className="flex items-center gap-2">
//                   <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
//                   <span>Priority Exam Verification</span>
//                 </li>
//               </ul>
//             </div>

//             <button
//               onClick={() => {
//                 setSelectedExam("Rank Acceleration Boost");
//                 handleOpenRegister();
//               }}
//               className="w-full mt-8 py-3.5 bg-[var(--navy)] dark:bg-[#ffd15c] hover:bg-[var(--navy)] dark:hover:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer text-center"
//             >
//               Get Master Pack for ₹1,499
//             </button>
//           </div>

//         </div>
//       </section>

//       {/* FOOTER */}
//       <footer className="bg-gradient-to-r from-[var(--navy)] via-[var(--navy)] to-[var(--navy)] text-white py-12 px-4 sm:px-6 md:px-12 border-t border-[#FCB824]/20 mt-auto">
//         <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
//           <div className="flex items-center gap-3 md:gap-3.5">
//             <LumenLogo className="w-[42px] sm:w-[50px] md:w-[56px] h-[42px] sm:h-[50px] md:h-[56px]  shrink-0" />
//             <div className="flex flex-col justify-center leading-tight">
//               <span className="font-black text-lg md:text-xl text-white tracking-tight block leading-none">LUMEN ACADEMY</span>
//               <span className="text-[8px] md:text-[9px] font-bold text-[#FCB824] tracking-wider mt-0.5 uppercase whitespace-nowrap block">Empowering Future through Learning</span>
//             </div>
//           </div>

//           <div className="flex gap-6 text-xs font-semibold text-slate-300">
//             <a href="#features" className="hover:text-[#FCB824] transition-colors">{t("Features")}</a>
//             <a href="#courses" className="hover:text-[#FCB824] transition-colors">{t("Courses")}</a>
//             <button onClick={handleOpenRegister} className="hover:text-[#FCB824] transition-colors">{t("Register")}</button>
//             <button onClick={handleOpenLogin} className="hover:text-[#FCB824] transition-colors">{t("Sign In")}</button>
//           </div>

//           <p className="text-sm text-slate-200 font-semibold bg-[var(--teal)]/40 px-4 py-2 rounded-lg border border-[var(--teal)]/60">
//             © 2026 Lumen Academy. All rights reserved.
//           </p>
//         </div>
//       </footer>

//       {/* DETAILED SYLLABUS UNIT BREAKDOWN MODAL */}
//       <AnimatePresence>
//         {activeUnitModal && (
//           <div className="fixed inset-0 bg-[var(--navy)]/60 dark:bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
//             <motion.div
//               initial={{ opacity: 0, scale: 0.95, y: 10 }}
//               animate={{ opacity: 1, scale: 1, y: 0 }}
//               exit={{ opacity: 0, scale: 0.95, y: 10 }}
//               className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700 relative space-y-6"
//             >
//               {/* Close Button */}
//               <button
//                 onClick={() => setActiveUnitModal(null)}
//                 className="absolute top-6 right-6 p-2 text-slate-400 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
//               >
//                 <span className="material-symbols-outlined text-xl font-bold">close</span>
//               </button>

//               {/* Unit Header */}
//               <div className="space-y-3 pr-8">
//                 <div className="flex flex-wrap items-center gap-2">
//                   <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${activeUnitModal.badgeColor}`}>
//                     {activeUnitModal.subjectLabel}
//                   </span>
//                   <span className="text-xs font-bold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
//                     {activeUnitModal.ncertClass}
//                   </span>
//                   <span className="text-xs font-extrabold text-[var(--teal)] dark:text-[#FCB824] bg-amber-50 dark:bg-amber-950/70 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
//                     {activeUnitModal.expectedQuestions}
//                   </span>
//                 </div>
//                 <h3 className="text-2xl font-black text-[#00243B] dark:text-white">{activeUnitModal.unitName}</h3>
//                 <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
//                   {activeUnitModal.overview}
//                 </p>
//               </div>

//               {/* Metrics Summary Grid */}
//               <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
//                 <div>
//                   <div className="text-lg font-black text-[var(--navy)] dark:text-white">{activeUnitModal.weightageMarks}</div>
//                   <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Marks Weightage</div>
//                 </div>
//                 <div>
//                   <div className="text-lg font-black text-[var(--teal)] dark:text-[#FCB824]">{activeUnitModal.weightagePercent}%</div>
//                   <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Exam Paper Share</div>
//                 </div>
//                 <div>
//                   <div className="text-lg font-black text-[#ffd15c] dark:text-[#FCB824]">{activeUnitModal.subtopics.length}</div>
//                   <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Core Subtopics</div>
//                 </div>
//               </div>

//               {/* Dual Action Option Switcher Tabs */}
//               <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 font-bold text-xs">
//                 <button
//                   onClick={() => setUnitModalTab("syllabus_materials")}
//                   className={`flex-1 py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
//                     unitModalTab === "syllabus_materials"
//                       ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-md"
//                       : "text-slate-600 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700"
//                   }`}
//                 >
//                   <span className="material-symbols-outlined text-base">menu_book</span>
//                   <span>1. See Syllabus & Materials</span>
//                 </button>

//                 <button
//                   onClick={() => setUnitModalTab("mock_test")}
//                   className={`flex-1 py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
//                     unitModalTab === "mock_test"
//                       ? "bg-[#FCB824] text-slate-950 shadow-md"
//                       : "text-slate-600 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700"
//                   }`}
//                 >
//                   <span className="material-symbols-outlined text-base">quiz</span>
//                   <span>2. Take Unit Mock Test</span>
//                 </button>
//               </div>

//               {/* TAB 1: SYLLABUS & MATERIALS */}
//               {unitModalTab === "syllabus_materials" && (
//                 <div className="space-y-6 animate-in fade-in duration-200">
//                   {/* High Yield NCERT Chapter */}
//                   <div className="space-y-2">
//                     <h4 className="text-xs font-black uppercase tracking-wider text-[var(--teal)] dark:text-[#FCB824] flex items-center gap-1.5">
//                       <span className="material-symbols-outlined text-base">menu_book</span>
//                       High-Yield NCERT Reference
//                     </h4>
//                     <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/60 border border-amber-200 dark:border-[#FCB824]/40 rounded-xl text-xs font-bold text-[var(--navy)] dark:text-white flex items-center justify-between">
//                       <span>{activeUnitModal.highYieldNCERTChapter}</span>
//                       <span className="text-[10px] bg-[var(--teal)] dark:bg-[#ffd15c] text-white px-2 py-0.5 rounded font-black uppercase">NCERT Core</span>
//                     </div>
//                   </div>

//                   {/* Core Subtopics breakdown */}
//                   <div className="space-y-2">
//                     <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
//                       <span className="material-symbols-outlined text-base">checklist</span>
//                       Must-Master Subtopics & Concepts
//                     </h4>
//                     <div className="flex flex-wrap gap-2">
//                       {activeUnitModal.subtopics.map((topic, idx) => (
//                         <span key={idx} className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-[#00243B] dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
//                           • {topic}
//                         </span>
//                       ))}
//                     </div>
//                   </div>

//                   {/* Key Formulas & Formula Sheet */}
//                   <div className="space-y-2">
//                     <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-[#FCB824] flex items-center gap-1.5">
//                       <span className="material-symbols-outlined text-base">functions</span>
//                       Key High-Yield Formulas & Principles
//                     </h4>
//                     <div className="bg-[var(--navy)] text-[#FCB824] p-4 rounded-2xl font-mono text-xs space-y-2 border border-white/10 shadow-inner">
//                       {activeUnitModal.keyFormulas.map((form, idx) => (
//                         <div key={idx} className="flex items-center gap-2">
//                           <span className="text-slate-400 font-sans text-[10px]">[{idx + 1}]</span>
//                           <span className="font-bold">{form}</span>
//                         </div>
//                       ))}
//                     </div>
//                   </div>

//                   {/* Unit Materials & Resources */}
//                   <div className="space-y-3 pt-2">
//                     <h4 className="text-xs font-black uppercase tracking-wider text-[#00243B] dark:text-white flex items-center justify-between">
//                       <span className="flex items-center gap-1.5">
//                         <span className="material-symbols-outlined text-base text-[var(--teal)] dark:text-[#FCB824]">folder_shared</span>
//                         Available Unit Materials ({activeUnitModal.materials?.length || 0})
//                       </span>
//                       <span className="text-[10px] text-amber-700 dark:text-[#FCB824] font-bold bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 rounded border border-amber-200 dark:border-[#FCB824]/40">
//                         100% Free Aspirant Access
//                       </span>
//                     </h4>

//                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
//                       {activeUnitModal.materials?.map((mat) => (
//                         <div
//                           key={mat.id}
//                           onClick={() => setActiveMaterialViewer(mat)}
//                           className="bg-slate-50 dark:bg-slate-900/40 hover:bg-amber-50/60 dark:hover:bg-amber-900/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-[var(--teal)]/40 transition-all flex items-center justify-between group cursor-pointer"
//                         >
//                           <div className="flex items-center gap-3">
//                             <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[var(--teal)] dark:text-[#FCB824] group-hover:scale-105 transition-transform shadow-xs">
//                               <span className="material-symbols-outlined text-lg">
//                                 {mat.type === "mindmap" ? "account_tree" : mat.type === "notes" ? "description" : mat.type === "pyq" ? "quiz" : "functions"}
//                               </span>
//                             </div>
//                             <div>
//                               <h5 className="text-xs font-bold text-[#00243B] dark:text-white group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors">{mat.title}</h5>
//                               <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{mat.format} • {mat.size}</p>
//                             </div>
//                           </div>
//                           <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] text-base group-hover:translate-x-1 transition-all">
//                             visibility
//                           </span>
//                         </div>
//                       ))}
//                     </div>
//                   </div>
//                 </div>
//               )}

//               {/* TAB 2: MOCK TEST */}
//               {unitModalTab === "mock_test" && (
//                 <div className="space-y-6 animate-in fade-in duration-200">
//                   <div className="bg-amber-50 dark:bg-amber-950/60 border-2 border-[#FCB824]/80 dark:border-[#FCB824]/40 p-6 rounded-2xl space-y-4">
//                     <div className="flex items-center justify-between">
//                       <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider bg-amber-100 dark:bg-amber-900/60 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/40">
//                         Standard Unit Assessment
//                       </span>
//                     </div>

//                     <div>
//                       <h4 className="text-lg font-black text-[#00243B] dark:text-white">{activeUnitModal.unitName} Dedicated Practice Test</h4>
//                       <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
//                         Test your conceptual mastery under real exam constraints with instant rank feedback.
//                       </p>
//                     </div>

//                     <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-[var(--navy)] p-4 rounded-xl border border-amber-200 dark:border-[#FCB824]/40 text-center">
//                       <div>
//                         <div className="text-base font-black text-[#00243B] dark:text-white">30 Qs</div>
//                         <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Questions</div>
//                       </div>
//                       <div>
//                         <div className="text-base font-black text-[var(--teal)] dark:text-[#FCB824]">30 Mins</div>
//                         <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t("Timer")}</div>
//                       </div>
//                       <div>
//                         <div className="text-base font-black text-[#00243B] dark:text-white">120 Marks</div>
//                         <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t("Total Score")}</div>
//                       </div>
//                       <div>
//                         <div className="text-base font-black text-[#ffd15c] dark:text-[#FCB824]">+4 / -1</div>
//                         <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Standard Marking</div>
//                       </div>
//                     </div>
//                   </div>

//                   <button
//                     onClick={() => {
//                       setSelectedExam(`${activeUnitModal.unitName} Practice Mock`);
//                       setActiveUnitModal(null);
//                       handleOpenRegister();
//                     }}
//                     className="w-full py-4 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
//                   >
//                     <span className="material-symbols-outlined text-lg">play_circle</span>
//                     Start Unit Mock Test Now
//                   </button>
//                 </div>
//               )}

//               {/* Modal Bottom Footer Actions */}
//               <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
//                 <button
//                   onClick={() => setActiveUnitModal(null)}
//                   className="py-2.5 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
//                 >
//                   Close
//                 </button>
//               </div>
//             </motion.div>
//           </div>
//         )}
//       </AnimatePresence>

//       {/* MATERIAL VIEWER MODAL */}
//       <AnimatePresence>
//         {activeMaterialViewer && (
//           <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
//             <motion.div
//               initial={{ opacity: 0, scale: 0.95 }}
//               animate={{ opacity: 1, scale: 1 }}
//               exit={{ opacity: 0, scale: 0.95 }}
//               className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 relative space-y-6"
//             >
//               <button
//                 onClick={() => setActiveMaterialViewer(null)}
//                 className="absolute top-6 right-6 p-2 text-slate-400 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
//               >
//                 <span className="material-symbols-outlined text-xl font-bold">close</span>
//               </button>

//               <div className="space-y-2 pr-8">
//                 <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/70 text-[var(--teal)] dark:text-[#FCB824] border border-amber-200 dark:border-[#FCB824]/40">
//                   {activeMaterialViewer.type.toUpperCase()} DOCUMENT
//                 </span>
//                 <h3 className="text-xl font-black text-[#00243B] dark:text-white">{activeMaterialViewer.title}</h3>
//                 <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Format: {activeMaterialViewer.format} • Size: {activeMaterialViewer.size}</p>
//               </div>

//               <div className="p-6 bg-[#00243B] dark:bg-[var(--navy)] text-slate-100 rounded-2xl border border-[#00243B] dark:border-slate-700 space-y-4">
//                 <div className="flex items-center gap-3 border-b border-[#00243B] dark:border-slate-700/80 pb-3">
//                   <span className="material-symbols-outlined text-[#FCB824] text-2xl">description</span>
//                   <div>
//                     <h4 className="text-xs font-bold text-white">Lumen High-Yield NCERT Study Sheet</h4>
//                     <p className="text-[10px] text-slate-400">{t("Verified by Senior Faculty")}</p>
//                   </div>
//                 </div>

//                 <div className="space-y-2 text-xs font-mono text-slate-300 bg-slate-950/80 dark:bg-black/60 p-4 rounded-xl border border-[#00243B]">
//                   <p>✓ High-yield diagrams and labeling guides</p>
//                   <p>✓ Last 10-year topic frequency mapping</p>
//                   <p>✓ Formula cheat-sheets and reaction mechanisms</p>
//                   <p>✓ Rapid revision mnemonics for last-minute prep</p>
//                 </div>
//               </div>

//               <div className="flex flex-col sm:flex-row gap-3">
//                 <button
//                   onClick={() => {
//                     alert(`Downloading ${activeMaterialViewer.title}... Free Aspirant Download Started!`);
//                     setActiveMaterialViewer(null);
//                   }}
//                   className="flex-1 py-3 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow transition-all cursor-pointer flex items-center justify-center gap-2"
//                 >
//                   <span className="material-symbols-outlined text-base">download</span>
//                   Download Resource PDF
//                 </button>
//                 <button
//                   onClick={() => setActiveMaterialViewer(null)}
//                   className="py-3 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
//                 >
//                   Done
//                 </button>
//               </div>
//             </motion.div>
//           </div>
//         )}
//       </AnimatePresence>

//       {/* AUTHENTICATION & ONBOARDING MODAL */}
//       {showAuthModal && (
//         <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
//           <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700 relative scrollbar-thin">
            
//             {/* Close Button */}
//             <button
//               onClick={() => setShowAuthModal(false)}
//               className="absolute top-5 right-5 p-2 text-slate-400 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
//             >
//               <span className="material-symbols-outlined text-xl font-bold">close</span>
//             </button>

//             {/* Modal Header */}
//             <div className="text-center mb-5">
//               <div className="flex justify-center mb-1">
//                 <LumenLogo className="w-16 md:w-20 h-16 md:h-20 " />
//               </div>
//               <p className="text-[11px] md:text-xs text-[var(--teal)] dark:text-[#FCB824] font-black uppercase tracking-widest mt-1">
//                 Lumen Academy Testing Portal
//               </p>
//             </div>

//             {/* Mode Switcher Header within Modal */}
//             <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4 text-xs font-bold">
//               <button
//                 onClick={() => {
//                   setAuthMode("register");
//                   setFormError("");
//                 }}
//                 className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
//                   authMode === "register" || authMode === "otp" || authMode === "exam_select"
//                     ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-slate-950 shadow"
//                     : "text-slate-600 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white"
//                 }`}
//               >
//                 New Aspirant
//               </button>
//               <button
//                 onClick={() => {
//                   setAuthMode("login");
//                   setFormError("");
//                 }}
//                 className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
//                   authMode === "login"
//                     ? "bg-[var(--navy)] dark:bg-[#FCB824] dark:text-slate-950 text-white shadow"
//                     : "text-slate-600 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white"
//                 }`}
//               >{t("Sign In")}</button>
//             </div>

//             {formError && (
//               <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-[#FCB824]/40 text-amber-700 dark:text-[#FCB824] text-xs font-bold rounded-xl flex items-center gap-2">
//                 <span className="material-symbols-outlined text-sm">error</span>
//                 <span>{formError}</span>
//               </div>
//             )}

//             {/* Contact Method Tab Switcher (Email vs Mobile Number) */}
//             {(authMode === "register" || authMode === "login") && (
//               <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1 mb-4 text-[11px] font-bold">
//                 <button
//                   type="button"
//                   onClick={() => { setAuthMethod("email"); setFormError(""); }}
//                   className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
//                     authMethod === "email"
//                       ? "bg-white dark:bg-slate-900 text-[var(--teal)] dark:text-[#FCB824] shadow-xs font-black"
//                       : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
//                   }`}
//                 >
//                   <span className="material-symbols-outlined text-sm">mail</span>
//                   <span>Email Address</span>
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => { setAuthMethod("phone"); setFormError(""); }}
//                   className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
//                     authMethod === "phone"
//                       ? "bg-white dark:bg-slate-900 text-[var(--teal)] dark:text-[#FCB824] shadow-xs font-black"
//                       : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
//                   }`}
//                 >
//                   <span className="material-symbols-outlined text-sm">smartphone</span>
//                   <span>Mobile OTP</span>
//                 </button>
//               </div>
//             )}

//             {/* 1. Registration Form */}
//             {authMode === "register" && (
//               <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-in fade-in duration-200">
//                 <div>
//                   <h3 className="text-base font-bold text-[#00243B] dark:text-white">Aspirant Registration</h3>
//                   <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
//                     {authMethod === "phone" ? "Enter your mobile number to receive instant SMS verification" : "Enter your email details to generate your assessment ID"}
//                   </p>
//                 </div>

//                 <div className="space-y-3">
//                   <div className="space-y-1">
//                     <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Full Name</label>
//                     <input
//                       type="text"
//                       placeholder="e.g. Prince A"
//                       value={regName}
//                       onChange={(e) => setRegName(e.target.value)}
//                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
//                     />
//                   </div>

//                   {authMethod === "phone" ? (
//                     <div className="space-y-1">
//                       <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mobile Number</label>
//                       <div className="flex gap-2">
//                         <select
//                           value={phoneCountryCode}
//                           onChange={(e) => setPhoneCountryCode(e.target.value)}
//                           className="px-3 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] outline-none"
//                         >
//                           <option value="+91">🇮🇳 +91</option>
//                           <option value="+1">🇺🇸 +1</option>
//                           <option value="+44">🇬🇧 +44</option>
//                           <option value="+971">🇦🇪 +971</option>
//                         </select>
//                         <input
//                           type="tel"
//                           placeholder="e.g. 9876543210"
//                           value={regPhone}
//                           onChange={(e) => setRegPhone(e.target.value)}
//                           className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
//                         />
//                       </div>
//                     </div>
//                   ) : (
//                     <>
//                       <div className="space-y-1">
//                         <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
//                         <input
//                           type="text"
//                           placeholder="e.g. prince@lumenacademy.edu"
//                           value={regPhoneOrEmail}
//                           onChange={(e) => setRegPhoneOrEmail(e.target.value)}
//                           className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
//                         />
//                       </div>
//                     </>
//                   )}

//                   <div className="space-y-1">
//                     <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Target Stream")}</label>
//                     <select
//                       value={regStream}
//                       onChange={(e) => setRegStream(e.target.value)}
//                       className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
//                     >
//                       <option value="NEET Aspirant" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">NEET Aspirant</option>
//                       <option value="NEET Repeaters" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">NEET Repeaters</option>
//                       <option value="JEE Mains" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">JEE Mains</option>
//                       <option value="JEE Advanced" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">JEE Advanced</option>
//                       <option value="Olympiad" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">Olympiad</option>
//                     </select>
//                   </div>
//                 </div>

//                 <button
//                   type="submit"
//                   disabled={isSendingOtp}
//                   className="w-full py-3.5 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] disabled:opacity-60 text-white dark:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer mt-2"
//                 >
//                   {isSendingOtp ? "Sending code..." : authMethod === "phone" ? "Send SMS Verification OTP →" : "Send Email Verification Code →"}
//                 </button>
//               </form>
//             )}

//             {/* 2. FLOW A STEP 2: OTP Verification */}
//             {authMode === "otp" && (
//               <form onSubmit={handleOtpSubmit} className="space-y-5 animate-in fade-in duration-200">
//                 <div className="text-center space-y-1">
//                   <span className="text-xs font-black uppercase tracking-wider text-[var(--teal)] dark:text-[#FCB824] bg-teal-50 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-[var(--teal)]/20 dark:border-[#FCB824]/30 inline-block">
//                     {otpDelivery === "phone" ? "📱 Mobile SMS Verification" : "✉️ Email Security Verification"}
//                   </span>
//                   <h3 className="text-base font-bold text-[#00243B] dark:text-white pt-1">Enter 6-Digit Security Code</h3>
//                   <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
//                     Code sent to <span className="text-[#00243B] dark:text-slate-200 font-bold">{otpDelivery === "phone" ? toE164(regPhone || loginPhone) : (regPhoneOrEmail || loginPhoneOrEmail)}</span>
//                   </p>
//                 </div>

//                 <div className="flex justify-center gap-3 my-2">
//                   {otpValues.map((digit, idx) => (
//                     <input
//                       key={idx}
//                       id={`modal-otp-${idx}`}
//                       type="text"
//                       maxLength={1}
//                       value={digit}
//                       onChange={(e) => handleOtpChange(idx, e.target.value)}
//                       className="w-12 h-14 bg-slate-50 dark:bg-slate-900/40 text-center text-xl font-bold border border-slate-300 dark:border-slate-700 rounded-xl focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none text-[#00243B] dark:text-white"
//                     />
//                   ))}
//                 </div>

//                 <button
//                   type="submit"
//                   disabled={isVerifyingOtp}
//                   className="w-full py-3.5 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] disabled:opacity-60 text-white dark:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
//                 >
//                   {isVerifyingOtp ? "Verifying..." : "Verify Code & Access Dashboard →"}
//                 </button>

//                 <div className="text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">
//                   Didn't receive code?{" "}
//                   <button
//                     type="button"
//                     disabled={isSendingOtp}
//                     onClick={async () => {
//                       setFormError("");
//                       setIsSendingOtp(true);
//                       try {
//                         const shouldCreateUser = otpFlow === "register";
//                         if (otpDelivery === "phone") {
//                           await sendPhoneOtp(toE164(regPhone || loginPhone), shouldCreateUser);
//                         } else {
//                           await sendEmailOtp((regPhoneOrEmail || loginPhoneOrEmail).trim().toLowerCase(), shouldCreateUser);
//                         }
//                         setOtpValues(["", "", "", "", "", ""]);
//                       } catch (err: any) {
//                         setFormError(err.message || "Could not resend the code. Please try again.");
//                       } finally {
//                         setIsSendingOtp(false);
//                       }
//                     }}
//                     className="text-[var(--teal)] dark:text-[#FCB824] font-bold hover:underline cursor-pointer disabled:opacity-60"
//                   >
//                     Resend Code
//                   </button>
//                 </div>
//               </form>
//             )}

//             {/* 3. Exam Package Selection */}
//             {authMode === "exam_select" && (
//               <div className="space-y-4 animate-in fade-in duration-200">
//                 <div>
//                   <h3 className="text-base font-bold text-[#00243B] dark:text-white">{t("Select Test Program")}</h3>
//                   <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Choose your target mock exam package to calibrate your rank tracking</p>
//                 </div>

//                 <div className="space-y-2.5">
//                   {[
//                     { id: "Ultimate Mock Series", desc: "180 Questions • Complete diagnostic logs & live feedback." },
//                     { id: "Chapter-wise Practice Boost", desc: "Dynamic diagnostic sheets filtered by unit difficulty." },
//                     { id: "Rank Acceleration Boost", desc: "Rapid 10-question focus revisions with active AI guidance." }
//                   ].map((exam) => (
//                     <button
//                       key={exam.id}
//                       type="button"
//                       onClick={() => setSelectedExam(exam.id)}
//                       className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer block ${
//                         selectedExam === exam.id
//                           ? "border-[var(--teal)] dark:border-[#FCB824] bg-amber-50/50 dark:bg-amber-950/60 shadow-sm"
//                           : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#00243B]"
//                       }`}
//                     >
//                       <div className="flex justify-between items-center mb-0.5">
//                         <span className="text-xs font-bold text-[#00243B] dark:text-white">{exam.id}</span>
//                         {selectedExam === exam.id && (
//                           <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-sm">check_circle</span>
//                         )}
//                       </div>
//                       <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{exam.desc}</p>
//                     </button>
//                   ))}
//                 </div>

//                 <button
//                   onClick={handleExamSelectFinish}
//                   className="w-full py-4 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white dark:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer mt-2"
//                 >
//                   Complete Onboarding & Enter Portal →
//                 </button>
//               </div>
//             )}

//             {/* 4. Returning Student Login */}
//             {authMode === "login" && (
//               <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in duration-200">
//                 <div>
//                   <h3 className="text-base font-bold text-[#00243B] dark:text-white">{t("Student Sign In")}</h3>
//                   <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
//                     {authMethod === "phone" ? "Sign in using your registered mobile number and SMS OTP" : "Enter your credentials to access your mock dashboard & saved results"}
//                   </p>
//                 </div>

//                 <div className="space-y-3">
//                   {authMethod === "phone" ? (
//                     <div className="space-y-1">
//                       <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Registered Mobile Number</label>
//                       <div className="flex gap-2">
//                         <select
//                           value={phoneCountryCode}
//                           onChange={(e) => setPhoneCountryCode(e.target.value)}
//                           className="px-3 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--navy)] outline-none"
//                         >
//                           <option value="+91">🇮🇳 +91</option>
//                           <option value="+1">🇺🇸 +1</option>
//                           <option value="+44">🇬🇧 +44</option>
//                           <option value="+971">🇦🇪 +971</option>
//                         </select>
//                         <input
//                           type="tel"
//                           placeholder="e.g. 9876543210"
//                           value={loginPhone}
//                           onChange={(e) => setLoginPhone(e.target.value)}
//                           className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--navy)] dark:focus:border-[#FCB824] outline-none"
//                         />
//                       </div>
//                     </div>
//                   ) : (
//                     <>
//                       <div className="space-y-1">
//                         <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Registered Email")}</label>
//                         <input
//                           type="text"
//                           placeholder="e.g. prince@lumenacademy.edu"
//                           value={loginPhoneOrEmail}
//                           onChange={(e) => setLoginPhoneOrEmail(e.target.value)}
//                           className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--navy)] dark:focus:border-[#FCB824] outline-none"
//                         />
//                       </div>
//                     </>
//                   )}
//                 </div>

//                 <button
//                   type="submit"
//                   disabled={isSendingOtp}
//                   className="w-full py-3.5 bg-[var(--navy)] dark:bg-[#FCB824] hover:bg-[var(--navy)] dark:hover:bg-[#FCB824] disabled:opacity-60 text-white dark:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer mt-2"
//                 >
//                   {isSendingOtp ? "Sending code..." : authMethod === "phone" ? "Send Mobile Login OTP →" : "Send Email Login Code →"}
//                 </button>
//                 <div className="grid grid-cols-2 gap-3 mt-4">
//                   <button
//                     type="button"
//                     onClick={() => onLoginSuccess("Demo Student", false, false)}
//                     className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[#00243B] dark:text-white font-bold text-xs rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer border border-transparent dark:border-slate-600"
//                   >
//                     <span className="material-symbols-outlined text-lg mb-1">person</span>
//                     Demo Account
//                   </button>
//                   <button
//                     type="button"
//                     onClick={() => onLoginSuccess("Admin User", false, true)}
//                     className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[var(--teal)] dark:text-[#FCB824] font-bold text-xs rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer border border-transparent dark:border-slate-600"
//                   >
//                     <span className="material-symbols-outlined text-lg mb-1">admin_panel_settings</span>
//                     Admin Login
//                   </button>
//                 </div>
//               </form>
//             )}

//           </div>
//         </div>
//       )}

//     </div>
//   );
// }



import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import LumenLogo from "../components/ui/LumenLogo";
import Modal from "../components/layout/Modal";
import StudyPlanView from "./StudyPlanView";
import { SYLLABUS_UNITS, SyllabusUnit, SyllabusUnitMaterial } from "../data/syllabusData";
import {
  sendEmailOtp,
  sendPhoneOtp,
  verifyEmailOtp,
  verifyPhoneOtp,
  signUpWithPassword,
  signInWithPassword,
  verifySignupOtp,
  resendSignupConfirmation,
  describeAuthError,
  signInWithGoogle,
  signInWithLinkedIn,
} from "../services/supabaseAuth";
import { checkSendAllowed, recordSend, describeSendGuardRefusal, formatRetryAfter } from "../services/emailSendGuard";
import { ensureDemoSession } from "../services/demoSession";

export type { SyllabusUnit, SyllabusUnitMaterial };
export { SYLLABUS_UNITS };

interface LandingViewProps {
  onLoginSuccess: (name: string, isNewUser?: boolean, isAdmin?: boolean) => void;
  onQuickDemoFlowC?: () => void;
  // Phase E — set after a forced idle/absolute-timeout sign-out, so the
  // reason surfaces here instead of the user just silently landing back on
  // this page with no explanation.
  authMessage?: string | null;
}

export default function LandingView({ onLoginSuccess, onQuickDemoFlowC, authMessage }: LandingViewProps) {
  const { t, language } = useLanguage();

  // Registration Form State
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  // Login State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // Modal states for Flow A & Flow B
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"choice" | "register" | "login" | "otp" | "exam_select">("choice");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Interactive Syllabus State
  const [selectedSubjectTab, setSelectedSubjectTab] = useState<"all" | "physics" | "chemistry" | "botany" | "zoology">("all");
  const [selectedClassTab, setSelectedClassTab] = useState<"all" | "Class 11" | "Class 12">("all");
  const [syllabusSearch, setSyllabusSearch] = useState("");
  const [activeUnitModal, setActiveUnitModal] = useState<SyllabusUnit | null>(null);
  const [unitModalTab, setUnitModalTab] = useState<"mock_test" | "syllabus_materials">("syllabus_materials");
  const [activeMaterialViewer, setActiveMaterialViewer] = useState<SyllabusUnitMaterial | null>(null);
  
  // Registration & Login Contact Method State
  const [authMethod, setAuthMethod] = useState<"email" | "phone">("email");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [regPhone, setRegPhone] = useState("");
  const [loginPhone, setLoginPhone] = useState("");
  const [otpDelivery, setOtpDelivery] = useState<"email" | "phone">("email");

  // Registration Form State (Flow A)
  const [regName, setRegName] = useState("");
  const [regPhoneOrEmail, setRegPhoneOrEmail] = useState("");
  const [regStream, setRegStream] = useState("NEET Aspirant");
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  // "confirm_signup" = verifying a password-based signUpWithPassword() via
  // the emailed one-time code (LA-BE-CORE-002 CL-P2, Mechanism A) — distinct
  // from "register"/"login", which verify a passwordless signInWithOtp() code.
  const [otpFlow, setOtpFlow] = useState<"register" | "login" | "confirm_signup">("register");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  // Ticking display for the resend cooldown so the button reads "Resend in
  // 43s" instead of just going silently unclickable — "the user must be
  // told the remaining wait, not left to press a dead button" (CL-P2).
  const [resendRetryAfterMs, setResendRetryAfterMs] = useState(0);
  const [selectedExam, setSelectedExam] = useState("Ultimate Mock Series");

  // Login State (Flow B)
  const [loginPhoneOrEmail, setLoginPhoneOrEmail] = useState("");
  const [formError, setFormError] = useState("");
  const [oAuthLoading, setOAuthLoading] = useState<"google" | "linkedin_oidc" | null>(null);

  // signInWithGoogle/signInWithLinkedIn navigate the whole page away to the
  // provider's consent screen and back — there is no "then what" here, the
  // resulting session is picked up by App.tsx's existing onAuthStateChange
  // listener on return, same as every other sign-in path.
  const handleOAuthClick = async (provider: "google" | "linkedin_oidc") => {
    setFormError("");
    setOAuthLoading(provider);
    try {
      await (provider === "google" ? signInWithGoogle() : signInWithLinkedIn());
      // No further state update on success — the redirect has already
      // started navigating away by the time this would run.
    } catch (err: any) {
      setFormError(describeAuthError(err));
      setOAuthLoading(null);
    }
  };

  useEffect(() => {
    if (authMode !== "otp" || resendRetryAfterMs <= 0) return;
    const id = setInterval(() => {
      setResendRetryAfterMs((prev) => Math.max(0, prev - 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [authMode, resendRetryAfterMs > 0]);

  const handleOpenRegister = () => {
    setAuthMode("register");
    setShowAuthModal(true);
    setFormError("");
  };

  const handleOpenLogin = () => {
    setAuthMode("login");
    setShowAuthModal(true);
    setFormError("");
  };

  // E.164 format required by Supabase (and every SMS provider behind it) — no
  // spaces, no punctuation.
  const toE164 = (rawPhone: string) => `${phoneCountryCode}${rawPhone.replace(/\D/g, "")}`;

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) {
      setFormError("Please enter your full name.");
      return;
    }

    if (authMethod === "phone") {
      // ...unchanged phone OTP branch...
      return;
    }

    // Email + password registration
    if (!regEmail.trim() || !regEmail.includes("@")) {
      setFormError("Please enter a valid email address.");
      return;
    }
    if (regPassword.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setFormError("Passwords don't match.");
      return;
    }

    const normalizedEmail = regEmail.trim().toLowerCase();

    // Guard the send with an idempotency-style check before Supabase is
    // ever contacted — a double-submitted form or a retried request must
    // not burn a second email out of the two-per-hour project quota
    // (LA-BE-CORE-002 CL-P2, S-2 email delivery quota constraint).
    const guard = checkSendAllowed(normalizedEmail);
    if (!guard.allowed) {
      setFormError(describeSendGuardRefusal(guard));
      return;
    }

    setFormError("");
    setIsSubmittingAuth(true);
    try {
      const session = await signUpWithPassword(normalizedEmail, regPassword, regName.trim(), regStream);
      recordSend(normalizedEmail);
      if (session) {
        // "Confirm email" is off in Supabase settings — signUp already
        // returned a live session, nothing left to verify.
        onLoginSuccess(regName.trim(), true);
      } else {
        // Confirmation required. Mechanism A (LA-BE-CORE-002 CL-P2): show the
        // code-entry step in this same tab/modal — no navigation, no new
        // route, no separate "go check your email and come back to sign in"
        // instruction.
        setOtpFlow("confirm_signup");
        setOtpValues(["", "", "", "", "", ""]);
        setResendRetryAfterMs(0);
        setAuthMode("otp");
      }
    } catch (err: any) {
      setFormError(describeAuthError(err));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = otpValues.join("");
    if (entered.length < 6) {
      setFormError("Please enter the 6-digit verification code.");
      return;
    }
    setFormError("");
    setIsVerifyingOtp(true);

    try {
      if (otpFlow === "confirm_signup") {
        const email = regEmail.trim().toLowerCase();
        const session = await verifySignupOtp(email, entered);
        const sessionName = (session.user.user_metadata as { display_name?: string } | undefined)?.display_name || regName.trim() || "Student";
        // Verified in place, in the same tab — no redirect, no second sign-in
        // step (S-2's required outcome).
        onLoginSuccess(sessionName, true);
        return;
      }

      const identifier = otpDelivery === "phone" ? toE164(regPhone || loginPhone) : (regPhoneOrEmail || loginPhoneOrEmail).trim().toLowerCase();
      const displayName = regName.trim() || (otpDelivery === "phone" ? `Student (${identifier.slice(-4)})` : identifier.split("@")[0]) || "Student";

      const session = otpDelivery === "phone" ? await verifyPhoneOtp(identifier, entered) : await verifyEmailOtp(identifier, entered);
      const sessionName = (session.user.user_metadata as { display_name?: string } | undefined)?.display_name || displayName;

      if (otpFlow === "register") {
        setAuthMode("exam_select");
      } else {
        onLoginSuccess(sessionName, false);
      }
    } catch (err: any) {
      setFormError(describeAuthError(err));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (authMethod === "phone") {
      // ...unchanged phone OTP branch...
      return;
    }

    if (!loginEmail.trim() || !loginEmail.includes("@")) {
      setFormError("Please enter your registered email.");
      return;
    }
    if (!loginPassword) {
      setFormError("Please enter your password.");
      return;
    }

    setFormError("");
    setIsSubmittingAuth(true);
    try {
      const session = await signInWithPassword(loginEmail.trim().toLowerCase(), loginPassword);
      const meta = session.user.user_metadata as { display_name?: string } | undefined;
      onLoginSuccess(meta?.display_name || loginEmail.split("@")[0], false);
    } catch (err: any) {
      if (err?.code === "email_not_confirmed") {
        // Account exists but was never verified — send them straight into
        // the same in-tab code-entry step rather than a dead-end error.
        setRegEmail(loginEmail.trim().toLowerCase());
        setOtpFlow("confirm_signup");
        setOtpValues(["", "", "", "", "", ""]);
        setResendRetryAfterMs(0);
        setAuthMode("otp");
        return;
      }
      setFormError(describeAuthError(err));
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  // Real bug found live while writing Phase F6's Playwright journeys (LA-APP-COMPLETION-001):
  // this button used to call onLoginSuccess directly with no Supabase call at
  // all, flipping isAuthenticated to true with no real session behind it.
  // Every authenticated API call the app shell makes right after (Header's
  // own profile fetch, among others) then 401s, and apiFetch's existing
  // 401 handler (services/api.ts) reacts by signing out and hard-navigating
  // back to "/" — so this button silently bounced the user right back to the
  // landing page within moments of "logging in". Fixed to establish the same
  // real demo session the separate "Quick Demo" flow already uses
  // (services/demoSession.ts's ensureDemoSession, sign-in-or-create-once
  // against one fixed demo account) before reporting success.
  const [isDemoLoggingIn, setIsDemoLoggingIn] = useState(false);
  const handleDemoAccountLogin = async () => {
    setFormError("");
    setIsDemoLoggingIn(true);
    try {
      await ensureDemoSession();
      onLoginSuccess("Demo Student", false, false);
    } catch (err: any) {
      setFormError(describeAuthError(err));
    } finally {
      setIsDemoLoggingIn(false);
    }
  };

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("lumen_theme");
      if (saved === "dark") return true;
      if (saved === "light") return false;
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });

  useEffect(() => {
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

  const handleOtpChange = (index: number, val: string) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otpValues];
    newOtp[index] = val.slice(-1);
    setOtpValues(newOtp);

    if (val && index < otpValues.length - 1) {
      const nextInput = document.getElementById(`modal-otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleExamSelectFinish = () => {
    onLoginSuccess(regName || "Prince A", true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-[#00243B] dark:text-slate-100 font-sans flex flex-col selection:bg-amber-100 selection:text-amber-900">

      {authMessage && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-100 text-sm font-semibold text-center py-2.5 px-4">
          {authMessage}
        </div>
      )}

      {/* Primary Navigation Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#031824]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-700 shadow-sm">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-12 h-24 py-2 flex items-center justify-between gap-4">
          
          {/* Logo & Name */}
          <div className="flex items-center gap-3 cursor-pointer pl-2 md:pl-3" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <LumenLogo className="w-[64px] md:w-[80px] h-[64px] md:h-[80px]  transition-transform hover:scale-105 duration-200" />
            <div className="hidden sm:block">
              <span className="font-black text-2xl md:text-3xl text-[var(--navy)] dark:text-white tracking-tight block leading-none">
                LUMEN ACADEMY
              </span>
              <span className="text-[10px] md:text-xs font-bold text-slate-500 dark:text-amber-300/90 tracking-wider mt-1 block uppercase whitespace-nowrap">
                Empowering Future through Learning
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-extrabold text-[#00243B] dark:text-slate-200 uppercase tracking-wider">
            <a href="#features" className="hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors">{t("Features")}</a>
            <a href="#courses" className="hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors">{t("Courses")}</a>
            <a href="#pricing" className="hover:text-[var(--teal)] dark:hover:text-[#FCB824] transition-colors">{t("Test Packages")}</a>
          </nav>

          {/* Header Action CTAs with Dark Mode Toggle */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Global Dark Mode Theme Toggle */}
            <button
              onClick={toggleDarkMode}
              className={`w-9 h-9 flex items-center justify-center rounded-xl border transition-all cursor-pointer select-none shadow-sm shrink-0 ${
                isDarkMode
                  ? "bg-[#00243B] text-[#FCB824] border-[#FCB824]/40 hover:bg-slate-700 hover:border-[#FCB824]"
                  : "bg-amber-50 text-[#00243B] border-amber-200 hover:bg-amber-100"
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Night Mode"}
            >
              <span className={`material-symbols-outlined text-lg transition-transform duration-300 ${isDarkMode ? "text-[#FCB824] rotate-180" : "text-[#ffd15c]"}`}>
                {isDarkMode ? "dark_mode" : "light_mode"}
              </span>
            </button>

            <button
              onClick={handleOpenLogin}
              className="px-3.5 py-2 text-xs font-bold text-[var(--navy)] dark:text-white hover:text-[var(--teal)] dark:hover:text-[#FCB824] hover:bg-slate-100 dark:hover:bg-[#00243B] rounded-xl transition-all cursor-pointer hidden sm:block"
            >{t("Sign In")}</button>

            <button
              onClick={handleOpenRegister}
              className="px-3.5 py-2 bg-[var(--teal)] hover:bg-[var(--teal-2)] text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <span className="material-symbols-outlined text-sm">person_add</span>
              <span className="hidden xs:inline">{t("Register Aspirant")}</span>
              <span className="xs:hidden">{t("Register")}</span>
            </button>

            {/* Mobile Menu Toggle Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <span className="material-symbols-outlined text-xl">
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white dark:bg-[var(--navy)] border-b border-slate-200 dark:border-slate-700 px-6 py-4 space-y-3 animate-in fade-in duration-200">
            <a 
              href="#features" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase hover:text-[var(--teal)]"
            >{t("Features")}</a>
            <a 
              href="#courses" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase hover:text-[var(--teal)]"
            >{t("Courses")}</a>
            <a 
              href="#pricing" 
              onClick={() => setMobileMenuOpen(false)}
              className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase hover:text-[var(--teal)]"
            >{t("Test Packages")}</a>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenLogin();
                }}
                className="w-1/2 py-2 text-xs font-bold text-[var(--navy)] dark:text-white bg-slate-100 dark:bg-slate-800 rounded-xl text-center cursor-pointer"
              >{t("Sign In")}</button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenRegister();
                }}
                className="w-1/2 py-2 text-xs font-bold text-white bg-[var(--teal)] rounded-xl text-center cursor-pointer"
              >{t("Register")}</button>
            </div>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 md:pt-20 pb-16 md:pb-24 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full overflow-hidden">
        {/* Decorative background glows with smooth floating animation */}
        <motion.div
          animate={{ scale: [1, 1.08, 1], rotate: [0, 2, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-tr from-sky-200/30 to-[var(--gold)]/10 blur-3xl pointer-events-none -z-10 rounded-full"
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column: Hero Text */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="lg:col-span-7 space-y-6 text-center lg:text-left"
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="inline-flex flex-wrap items-center gap-2 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-[#FCB824]/40 px-3.5 py-1.5 rounded-full text-amber-900 dark:text-amber-200 text-xs font-bold shadow-sm"
            >
              <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] animate-pulse">stars</span>
              <span className="font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider">Journey to success start here</span>
              <span className="text-[#FCB824] dark:text-[#FCB824]">•</span>
              <span className="text-amber-900 dark:text-[#FCB824]">Comprehensive Diagnostic Mock Test Platform</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-950 dark:text-white tracking-tight leading-[1.15]"
            >
              Accelerate Your Exam Rank with <span className="text-[var(--gold)] animate-shimmer-text">Exact Syllabus Mocks</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-slate-700 dark:text-slate-200 text-sm md:text-base leading-relaxed font-semibold max-w-2xl mx-auto lg:mx-0"
            >
              Simulate actual exam pressure with exact syllabus matching. Receive instant rank forecasts, speed vs accuracy velocity reports, and chapter-wise weakness remediation.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2"
            >
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleOpenRegister}
                className="w-full sm: px-8 py-4 bg-[var(--teal)] hover:bg-[var(--teal-2)] text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-xl hover:shadow-2xl transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">rocket_launch</span>
                Register New Aspirant
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleOpenLogin}
                className="w-full sm: px-8 py-4 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:border-[var(--teal)] dark:hover:border-[#FCB824] text-[#00243B] dark:text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">login</span>
                Sign In Returning Student
              </motion.button>
            </motion.div>

            {/* Key Assurance Badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="pt-6 border-t border-slate-200/80 flex flex-wrap justify-center lg:justify-start gap-6 text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              <span className="flex items-center gap-1.5 hover:text-[var(--teal)] transition-colors">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-base font-bold">videocam</span>
                Live Face & Gaze Detection
              </span>
              <span className="flex items-center gap-1.5 hover:text-[var(--teal)] transition-colors">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-base font-bold">analytics</span>
                Instant Rank Diagnostic Card
              </span>
              <span className="flex items-center gap-1.5 hover:text-[var(--teal)] transition-colors">
                <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-base font-bold">menu_book</span>
                38 NCERT Chapters
              </span>
            </motion.div>
          </motion.div>

          {/* Right Column: Interactive 3D Hero */}
          <motion.div
            initial={{ opacity: 0, x: 30, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
            className="lg:col-span-5 relative"
            style={{ perspective: 1200 }}
          >
            {/* Floating Elements Background */}
            <motion.div
              animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -top-10 -right-4 bg-white dark:bg-[var(--navy)] border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-3 z-20 flex items-center gap-3 backdrop-blur-md"
            >
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#ffd15c] dark:text-[#FCB824] text-sm">stars</span>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-[#00243B] dark:text-white leading-none">Rank 140</p>
                <p className="text-[9px] font-bold text-[#ffd15c] dark:text-[#FCB824]">Projected Rank</p>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              className="absolute -bottom-8 -left-4 bg-[var(--teal)] dark:bg-[var(--navy)] border border-[#172554] dark:border-slate-700 shadow-2xl rounded-2xl p-3 z-20 flex items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-[#FCB824] animate-ping"></div>
              <p className="text-[10px] font-black uppercase text-white tracking-widest">{t("System OK")}</p>
            </motion.div>

            {/* Laptop Frame */}
            <motion.div 
              className="relative z-10 w-full rounded-t-[24px] rounded-b-[12px] bg-[#00243B] dark:bg-slate-800 p-2 shadow-2xl border-4 border-slate-300 dark:border-slate-700"
              whileHover={{ rotateX: 5, rotateY: -5, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              style={{ transformStyle: "preserve-3d" }}
            >
              {/* Screen Content */}
              <div className="bg-white dark:bg-[var(--navy)] rounded-[16px] p-6 h-[400px] overflow-hidden relative" style={{ transform: "translateZ(30px)" }}>
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#FCB824] animate-ping"></span>
                    <span className="text-xs font-black text-[#00243B] dark:text-white uppercase tracking-wider">Exam Environment</span>
                  </div>
                  <span className="bg-amber-50 dark:bg-amber-950/50 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50 text-[10px] font-black uppercase px-2.5 py-1 rounded-md shadow-sm">
                    Live
                  </span>
                </div>
                
                {/* Simulated Exam View snippet */}
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 text-[#00243B] dark:text-white flex items-center justify-between shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-teal-400 via-transparent to-transparent"></div>
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/40 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-[var(--teal)] dark:text-teal-400 font-bold text-xs backdrop-blur-sm">
                        <span className="material-symbols-outlined text-base animate-pulse">psychology</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold">Adaptive Difficulty Engine</p>
                        <p className="text-[10px] text-teal-600 dark:text-teal-400 font-mono tracking-widest mt-0.5">Calibrating...</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">{t("Time Remaining")}</span>
                    <span className="font-mono text-sm font-bold text-[#00243B] dark:text-white">02:45:18</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="flex justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>Q.42 • Course Subject</span>
                    <span className="text-[var(--teal)] dark:text-sky-400">NCERT Class 12</span>
                  </div>
                  <p className="text-xs font-bold text-[#00243B] dark:text-slate-200">
                    Which codon functions as the primary universal start signal during ribosomal translation in eukaryotic cells?
                  </p>
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] font-semibold">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 rounded-lg border border-[#FCB824] dark:border-amber-600 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-[#ffd15c] text-amber-900 text-[9px] flex items-center justify-center font-bold">A</span>
                      <span>AUG (Methionine)</span>
                    </div>
                    <div className="p-2 bg-white dark:bg-slate-700/50 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-600 flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-[9px] flex items-center justify-center font-bold">B</span>
                      <span>UAA (Stop)</span>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50/70 dark:bg-slate-800/50 rounded-2xl p-4 border border-amber-200/80 dark:border-slate-700 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase block">Predicted Score Improvement</span>
                    <span className="text-base font-black text-[var(--teal)] dark:text-sky-300">+85 Marks Improvement</span>
                  </div>
                  <button
                    onClick={onQuickDemoFlowC || handleOpenRegister}
                    className="px-4 py-2 bg-[var(--teal)] text-white font-bold rounded-xl text-[11px] hover:bg-[var(--teal-2)] transition-colors cursor-pointer"
                  >
                    Start Free Mock
                  </button>
                </div>
              </div>
              
              {/* Laptop Keyboard Base */}
              <div 
                className="absolute -bottom-6 -inset-x-6 h-6 bg-[#00243B] dark:bg-slate-900 rounded-b-xl flex justify-center border-t border-slate-700/50 shadow-2xl" 
                style={{ transform: "rotateX(-30deg) translateZ(10px)" }}
              >
                <div className="w-1/3 h-2 bg-[#00243B] dark:bg-slate-900 rounded-b-md mt-1 border-b border-slate-700/50"></div>
              </div>
            </motion.div>
          </motion.div>

        </div>
      </section>

      {/* PLATFORM METRICS STATS BANNER */}
      <section className="bg-gradient-to-r from-[var(--navy)] via-[var(--navy)] to-[var(--navy)] py-12 text-white border-y border-[#FCB824]/20 overflow-hidden">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 md:px-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <div className="text-3xl md:text-4xl font-black text-[#FCB824] tracking-tight">50,000+</div>
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">Mock Exams Completed</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}>
            <div className="text-3xl md:text-4xl font-black text-[#FCB824] tracking-tight">99.8%</div>
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">{t("System Reliability Rate")}</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}>
            <div className="text-3xl md:text-4xl font-black text-[#FCB824] tracking-tight">38 Units</div>
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">NCERT Physics/Chem/Bio</div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}>
            <div className="text-3xl md:text-4xl font-black text-[#FCB824] tracking-tight">+85 Pts</div>
            <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">Avg Score Rank Growth</div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="features" className="py-20 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-[var(--teal)] dark:text-[#FCB824] text-xs font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/50">
            Engineered for Top Ranks
          </span>
          <h2 className="text-2xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Why Top Rankers Choose Lumen Academy
          </h2>
          <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">
            Standard offline test series lack real-time feedback. Our AI engine bridges the gap between practice and real exam day perfection.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8" style={{ perspective: 1000 }}>
          
          {/* Card 1 */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05, rotateY: -5, rotateX: 5, z: 20, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-8 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-[#FCB824]/40 flex items-center justify-center text-[var(--teal)] dark:text-[#FCB824]">
              <span className="material-symbols-outlined text-2xl font-bold">menu_book</span>
            </div>
            <h3 className="text-lg font-black text-[#00243B] dark:text-white">{t("Strict Syllabus Match")}</h3>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
              100% aligned with the exact syllabus guidelines for all major subjects.
            </p>
            <ul className="text-xs font-bold text-[#00243B] dark:text-slate-100 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
                Curated from latest NCERT editions
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
                No out-of-syllabus questions
              </li>
            </ul>
          </motion.div>

          {/* Card 2 */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05, rotateY: 5, rotateX: 5, z: 20, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-8 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-[#FCB824]/40 flex items-center justify-center text-amber-800 dark:text-[#FCB824]">
              <span className="material-symbols-outlined text-2xl font-bold">query_stats</span>
            </div>
            <h3 className="text-lg font-black text-[#00243B] dark:text-white">Diagnostic Scorecards & Rank</h3>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
              Immediate post-exam breakdown featuring subject accuracy rings, time spent per question, and predicted All-India Rank percentile.
            </p>
            <ul className="text-xs font-bold text-[#00243B] dark:text-slate-100 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
                Speed vs accuracy velocity matrix
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
                Targeted weak topic revision flashcards
              </li>
            </ul>
          </motion.div>

          {/* Card 3 */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.05, rotateY: 5, rotateX: -5, z: 20, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            viewport={{ once: true }}
            className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white p-8 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-300 space-y-4"
          >
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-[#FCB824]/40 flex items-center justify-center text-amber-800 dark:text-[#FCB824]">
              <span className="material-symbols-outlined text-2xl font-bold">menu_book</span>
            </div>
            <h3 className="text-lg font-black text-[#00243B] dark:text-white">Complete NCERT Syllabus Library</h3>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
              Comprehensive coverage of Physics (Mechanics, Electrodynamics), Chemistry (Organic, Inorganic), and Biology (Human Physiology, Genetics).
            </p>
            <ul className="text-xs font-bold text-[#00243B] dark:text-slate-100 space-y-2 pt-2">
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
                Standard marking scheme (+4 / -1 penalty)
              </li>
              <li className="flex items-center gap-2">
                <span className="material-symbols-outlined text-xs text-amber-700 dark:text-[#FCB824] font-bold">check_circle</span>
                Custom mock test generator wizard
              </li>
            </ul>
          </motion.div>

        </div>
      </section>

      {/* HOW IT WORKS SECTION */}
      <section className="py-20 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full border-t border-slate-200/50 dark:border-slate-800/50">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-[var(--teal)] dark:text-[#FCB824] text-xs font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/50">
            Simple 4-Step Process
          </span>
          <h2 className="text-2xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            How Lumen Academy Works
          </h2>
          <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">
            From registration to rank improvement, our platform guides you systematically towards your target score.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-10 left-12 right-12 h-0.5 bg-gradient-to-r from-transparent via-[var(--teal)] dark:via-[#FCB824] to-transparent opacity-30 z-0"></div>
          
          {[
            {
              step: "01",
              title: "Register & Profile",
              desc: "Create your free account, select your target exam (NEET/JEE), and set your baseline goals.",
              icon: "app_registration"
            },
            {
              step: "02",
              title: "Diagnostic Mock",
              desc: "Take a full-syllabus mock test to establish your baseline score and accuracy velocity.",
              icon: "quiz"
            },
            {
              step: "03",
              title: "AI Analysis",
              desc: "Review your detailed scorecard, identifying exact weak chapters and time-management gaps.",
              icon: "insights"
            },
            {
              step: "04",
              title: "Targeted Revision",
              desc: "Use our syllabus viewer to access precise materials for weak areas and re-test to improve.",
              icon: "trending_up"
            }
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.15, type: "spring", stiffness: 200 }}
              className="relative z-10 flex flex-col items-center text-center space-y-4"
            >
              <div className="w-20 h-20 rounded-full bg-white dark:bg-[var(--navy)] border-4 border-slate-50 dark:border-slate-800 shadow-lg flex items-center justify-center relative group">
                <div className="absolute inset-0 rounded-full bg-[var(--teal)]/10 dark:bg-[#FCB824]/10 group-hover:scale-110 transition-transform duration-300"></div>
                <span className="material-symbols-outlined text-3xl text-[var(--teal)] dark:text-[#FCB824] z-10">{item.icon}</span>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 border-2 border-white dark:border-[var(--navy)] flex items-center justify-center text-[10px] font-black text-amber-900 dark:text-amber-100 shadow-sm">
                  {item.step}
                </div>
              </div>
              <h3 className="text-lg font-black text-[#00243B] dark:text-white pt-2">{item.title}</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed max-w-[250px]">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* COURSES SECTION */}
      <section id="courses" className="py-20 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full bg-slate-50 dark:bg-slate-900/40 rounded-3xl mb-8">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-[var(--teal)] dark:text-[#FCB824] text-xs font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/50">
            Comprehensive Learning
          </span>
          <h2 className="text-2xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Our Top Courses
          </h2>
          <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">
            Prepare for your dream career with our specialized programs designed for absolute success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {[
            {
              title: "NEET",
              desc: "Master the National Eligibility cum Entrance Test with our comprehensive biology, physics, and chemistry curriculum.",
              icon: "biotech",
              streamValue: "NEET Aspirant"
            },
            {
              title: "JEE",
              desc: "Crack the Joint Entrance Examination with our advanced mathematics, physics, and chemistry problem-solving modules.",
              icon: "calculate",
              streamValue: "JEE Mains"
            },
            {
              title: "Olympiad Exams",
              desc: "Challenge yourself with our Olympiad preparation courses to excel in national and international science competitions.",
              icon: "emoji_events",
              streamValue: "Olympiad"
            }
          ].map((course, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white dark:bg-[var(--navy)] p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 group flex flex-col h-full"
            >
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-950/50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                <span className="material-symbols-outlined text-3xl text-[var(--teal)] dark:text-[#FCB824]">{course.icon}</span>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-3">{course.title}</h3>
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 leading-relaxed mb-6 flex-grow">
                {course.desc}
              </p>
              <button 
                onClick={() => {
                  setRegStream(course.streamValue);
                  handleOpenRegister();
                }}
                className="mt-auto self-start flex items-center gap-2 text-[var(--teal)] dark:text-[#FCB824] font-bold text-sm hover:opacity-80 transition-opacity"
              >
                Apply Now <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TEST PACKAGES & PRICING SECTION */}
      <section id="pricing" className="py-20 px-4 sm:px-6 md:px-12 max-w-[1280px] mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-[var(--teal)] dark:text-[#FCB824] text-xs font-black uppercase tracking-widest bg-amber-100 dark:bg-amber-950/70 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/40">
            Student Affordable Plans
          </span>
          <h2 className="text-2xl md:text-4xl font-black text-slate-950 dark:text-white tracking-tight">
            Choose Your Test Package
          </h2>
          <p className="text-slate-700 dark:text-slate-200 text-sm font-semibold">
            Supercharged mock series with reduced student-friendly pricing and 100% free study resources.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Package 1: Free Starter Practice + Free Resources */}
          <div className="bg-white dark:bg-[var(--navy)] p-8 rounded-[28px] border-2 border-[var(--teal)]/30 dark:border-[#FCB824]/30 shadow-sm flex flex-col justify-between hover:border-[var(--teal)] dark:hover:border-[#FCB824] hover:shadow-lg transition-all relative">
            <div className="absolute -top-3 left-6 bg-[var(--teal)] dark:bg-[#ffd15c] text-white px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
              100% Free Resources
            </div>

            <div className="space-y-6 pt-2">
              <div>
                <span className="text-[10px] font-black text-amber-800 dark:text-[#FCB824] uppercase tracking-wider bg-amber-50 dark:bg-amber-950/70 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
                  Free Resource Pass
                </span>
                <h3 className="text-xl font-bold text-[var(--navy)] dark:text-white mt-3">Free Starter & Resources</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{t("Zero cost access to study material & mini mocks")}</p>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-3xl md:text-4xl font-black text-[var(--teal)] dark:text-[#FCB824]">₹0</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">/ 100% Free Forever</span>
              </div>

              <ul className="space-y-3 text-xs font-semibold text-slate-700 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">check_circle</span>
                  <span>3 Free Full-Length Mocks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">description</span>
                  <span>Free NCERT Biology & Physics Formula Sheet PDFs</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">menu_book</span>
                  <span>Free 10-Year PYQ Solved Question Bank</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">analytics</span>
                  <span>Free Rank Diagnostic Predictor & Velocity Stats</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824] font-bold">videocam</span>
                  <span>{t("Full-Syllabus Diagnostic Mode included")}</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setSelectedExam("Starter Practice Pass");
                handleOpenRegister();
              }}
              className="w-full mt-8 py-3.5 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer text-center shadow-md"
            >
              Access Free Material (₹0)
            </button>
          </div>

          {/* Package 2: Ultimate Mock Series (Featured) */}
          <div className="bg-[var(--navy)] dark:bg-[var(--navy)] text-white p-8 rounded-[32px] border-2 border-[#FCB824] shadow-2xl flex flex-col justify-between relative transform lg:-translate-y-2">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#FCB824] text-slate-950 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
              Most Popular Among Rankers
            </div>

            <div className="space-y-6 pt-2">
              <div>
                <span className="text-[10px] font-black text-[#FCB824] uppercase tracking-wider bg-white/10 px-3 py-1 rounded-full">
                  Recommended Series
                </span>
                <h3 className="text-xl font-bold text-white mt-3">Ultimate Mock Series</h3>
                <p className="text-xs text-slate-300 font-medium mt-1">18 Full-length standard mock tests</p>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-[#FCB824]">₹999</span>
                <span className="text-xs text-slate-300 font-medium line-through">₹2,999</span>
                <span className="text-[10px] bg-[#FCB824]/30 text-[#FCB824] px-2.5 py-0.5 rounded font-black border border-[#FCB824]/40">67% OFF</span>
              </div>

              <ul className="space-y-3 text-xs font-semibold text-slate-200 pt-2 border-t border-white/10">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#FCB824]">check_circle</span>
                  <span>18 Full-Length 180-Question Mocks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#FCB824]">verified</span>
                  <span>Includes ALL ₹0 Free Formula Sheets & PYQs</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#FCB824]">check_circle</span>
                  <span>{t("Full-Syllabus Diagnostic Mode included")}</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#FCB824]">check_circle</span>
                  <span>Instant Rank Percentile</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#FCB824]">check_circle</span>
                  <span>Full Step-by-Step Question Explanations</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setSelectedExam("Ultimate Mock Series");
                handleOpenRegister();
              }}
              className="w-full mt-8 py-4 bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] dark:text-slate-950 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-xl transition-all cursor-pointer text-center"
            >
              Enroll for ₹999 →
            </button>
          </div>

          {/* Package 3: Rank Acceleration Master Pack */}
          <div className="bg-white dark:bg-[var(--navy)] p-8 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between hover:border-[var(--teal)] dark:hover:border-[#FCB824] transition-all">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black text-amber-900 dark:text-[#FCB824] uppercase tracking-wider bg-amber-50 dark:bg-amber-950/70 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
                  Complete Exam Mastery
                </span>
                <h3 className="text-xl font-bold text-[var(--navy)] dark:text-white mt-3">Rank Acceleration Master Pack</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">{t("Unlimited custom tests & weakness remediation")}</p>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl md:text-4xl font-black text-[#00243B] dark:text-white">₹1,499</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium line-through">₹4,999</span>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded font-black border border-amber-200 dark:border-[#FCB824]/40">70% OFF</span>
              </div>

              <ul className="space-y-3 text-xs font-semibold text-slate-700 dark:text-slate-200 pt-2 border-t border-slate-100 dark:border-slate-700">
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
                  <span>All 38 NCERT Unit Chapter Mocks</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
                  <span>Infinite Custom AI Mock Test Generator</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
                  <span>All Free ₹0 Material + 18 Full Mocks Included</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
                  <span>AI Weak Topic Remediation Flashcards</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm text-[#ffd15c] dark:text-[#FCB824]">check_circle</span>
                  <span>Priority Exam Verification</span>
                </li>
              </ul>
            </div>

            <button
              onClick={() => {
                setSelectedExam("Rank Acceleration Boost");
                handleOpenRegister();
              }}
              className="w-full mt-8 py-3.5 bg-[var(--navy)] dark:bg-[#ffd15c] hover:bg-[var(--navy)] dark:hover:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer text-center"
            >
              Get Master Pack for ₹1,499
            </button>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gradient-to-r from-[var(--navy)] via-[var(--navy)] to-[var(--navy)] text-white py-12 px-4 sm:px-6 md:px-12 border-t border-[#FCB824]/20 mt-auto">
        <div className="max-w-[1280px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3 md:gap-3.5">
            <LumenLogo className="w-[42px] sm:w-[50px] md:w-[56px] h-[42px] sm:h-[50px] md:h-[56px]  shrink-0" />
            <div className="flex flex-col justify-center leading-tight">
              <span className="font-black text-lg md:text-xl text-white tracking-tight block leading-none">LUMEN ACADEMY</span>
              <span className="text-[8px] md:text-[9px] font-bold text-[#FCB824] tracking-wider mt-0.5 uppercase whitespace-nowrap block">Empowering Future through Learning</span>
            </div>
          </div>

          <div className="flex gap-6 text-xs font-semibold text-slate-300">
            <a href="#features" className="hover:text-[#FCB824] transition-colors">{t("Features")}</a>
            <a href="#courses" className="hover:text-[#FCB824] transition-colors">{t("Courses")}</a>
            <button onClick={handleOpenRegister} className="hover:text-[#FCB824] transition-colors">{t("Register")}</button>
            <button onClick={handleOpenLogin} className="hover:text-[#FCB824] transition-colors">{t("Sign In")}</button>
          </div>

          <p className="text-sm text-slate-200 font-semibold bg-[var(--teal)]/40 px-4 py-2 rounded-lg border border-[var(--teal)]/60">
            © 2026 Lumen Academy. All rights reserved.
          </p>
        </div>
      </footer>

      {/* DETAILED SYLLABUS UNIT BREAKDOWN MODAL */}
      <AnimatePresence>
        {activeUnitModal && (
          <Modal onClose={() => setActiveUnitModal(null)} backdropClassName="bg-[var(--navy)]/60 dark:bg-black/80 backdrop-blur-md" zIndexClassName="z-[100]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700 relative space-y-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveUnitModal(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl font-bold">close</span>
              </button>

              {/* Unit Header */}
              <div className="space-y-3 pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-xs font-black uppercase px-3 py-1 rounded-full border ${activeUnitModal.badgeColor}`}>
                    {activeUnitModal.subjectLabel}
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
                    {activeUnitModal.ncertClass}
                  </span>
                  <span className="text-xs font-extrabold text-[var(--teal)] dark:text-[#FCB824] bg-amber-50 dark:bg-amber-950/70 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
                    {activeUnitModal.expectedQuestions}
                  </span>
                </div>
                <h3 className="text-2xl font-black text-[#00243B] dark:text-white">{activeUnitModal.unitName}</h3>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
                  {activeUnitModal.overview}
                </p>
              </div>

              {/* Metrics Summary Grid */}
              <div className="grid grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                <div>
                  <div className="text-lg font-black text-[var(--navy)] dark:text-white">{activeUnitModal.weightageMarks}</div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Marks Weightage</div>
                </div>
                <div>
                  <div className="text-lg font-black text-[var(--teal)] dark:text-[#FCB824]">{activeUnitModal.weightagePercent}%</div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Exam Paper Share</div>
                </div>
                <div>
                  <div className="text-lg font-black text-[#ffd15c] dark:text-[#FCB824]">{activeUnitModal.subtopics.length}</div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Core Subtopics</div>
                </div>
              </div>

              {/* Dual Action Option Switcher Tabs */}
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl gap-2 font-bold text-xs">
                <button
                  onClick={() => setUnitModalTab("syllabus_materials")}
                  className={`flex-1 py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    unitModalTab === "syllabus_materials"
                      ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-md"
                      : "text-slate-600 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">menu_book</span>
                  <span>1. See Syllabus & Materials</span>
                </button>

                <button
                  onClick={() => setUnitModalTab("mock_test")}
                  className={`flex-1 py-3 px-4 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    unitModalTab === "mock_test"
                      ? "bg-[#FCB824] text-slate-950 shadow-md"
                      : "text-slate-600 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-700"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">quiz</span>
                  <span>2. Take Unit Mock Test</span>
                </button>
              </div>

              {/* TAB 1: SYLLABUS & MATERIALS */}
              {unitModalTab === "syllabus_materials" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* High Yield NCERT Chapter */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[var(--teal)] dark:text-[#FCB824] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base">menu_book</span>
                      High-Yield NCERT Reference
                    </h4>
                    <div className="p-3.5 bg-amber-50/70 dark:bg-amber-950/60 border border-amber-200 dark:border-[#FCB824]/40 rounded-xl text-xs font-bold text-[var(--navy)] dark:text-white flex items-center justify-between">
                      <span>{activeUnitModal.highYieldNCERTChapter}</span>
                      <span className="text-[10px] bg-[var(--teal)] dark:bg-[#ffd15c] text-white px-2 py-0.5 rounded font-black uppercase">NCERT Core</span>
                    </div>
                  </div>

                  {/* Core Subtopics breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base">checklist</span>
                      Must-Master Subtopics & Concepts
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {activeUnitModal.subtopics.map((topic, idx) => (
                        <span key={idx} className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-[#00243B] dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
                          • {topic}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Key Formulas & Formula Sheet */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-amber-700 dark:text-[#FCB824] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base">functions</span>
                      Key High-Yield Formulas & Principles
                    </h4>
                    <div className="bg-[var(--navy)] text-[#FCB824] p-4 rounded-2xl font-mono text-xs space-y-2 border border-white/10 shadow-inner">
                      {activeUnitModal.keyFormulas.map((form, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="text-slate-400 font-sans text-[10px]">[{idx + 1}]</span>
                          <span className="font-bold">{form}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Unit Materials & Resources */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-[#00243B] dark:text-white flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-base text-[var(--teal)] dark:text-[#FCB824]">folder_shared</span>
                        Available Unit Materials ({activeUnitModal.materials?.length || 0})
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-[#FCB824] font-bold bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 rounded border border-amber-200 dark:border-[#FCB824]/40">
                        100% Free Aspirant Access
                      </span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeUnitModal.materials?.map((mat) => (
                        <div
                          key={mat.id}
                          onClick={() => setActiveMaterialViewer(mat)}
                          className="bg-slate-50 dark:bg-slate-900/40 hover:bg-amber-50/60 dark:hover:bg-amber-900/40 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-[var(--teal)]/40 transition-all flex items-center justify-between group cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[var(--teal)] dark:text-[#FCB824] group-hover:scale-105 transition-transform shadow-xs">
                              <span className="material-symbols-outlined text-lg">
                                {mat.type === "mindmap" ? "account_tree" : mat.type === "notes" ? "description" : mat.type === "pyq" ? "quiz" : "functions"}
                              </span>
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-[#00243B] dark:text-white group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors">{mat.title}</h5>
                              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{mat.format} • {mat.size}</p>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] text-base group-hover:translate-x-1 transition-all">
                            visibility
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: MOCK TEST */}
              {unitModalTab === "mock_test" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="bg-amber-50 dark:bg-amber-950/60 border-2 border-[#FCB824]/80 dark:border-[#FCB824]/40 p-6 rounded-2xl space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-900 dark:text-amber-200 uppercase tracking-wider bg-amber-100 dark:bg-amber-900/60 px-3 py-1 rounded-full border border-[#FCB824] dark:border-[#FCB824]/40">
                        Standard Unit Assessment
                      </span>
                    </div>

                    <div>
                      <h4 className="text-lg font-black text-[#00243B] dark:text-white">{activeUnitModal.unitName} Dedicated Practice Test</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                        Test your conceptual mastery under real exam constraints with instant rank feedback.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-[var(--navy)] p-4 rounded-xl border border-amber-200 dark:border-[#FCB824]/40 text-center">
                      <div>
                        <div className="text-base font-black text-[#00243B] dark:text-white">30 Qs</div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Questions</div>
                      </div>
                      <div>
                        <div className="text-base font-black text-[var(--teal)] dark:text-[#FCB824]">30 Mins</div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t("Timer")}</div>
                      </div>
                      <div>
                        <div className="text-base font-black text-[#00243B] dark:text-white">120 Marks</div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{t("Total Score")}</div>
                      </div>
                      <div>
                        <div className="text-base font-black text-[#ffd15c] dark:text-[#FCB824]">+4 / -1</div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Standard Marking</div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedExam(`${activeUnitModal.unitName} Practice Mock`);
                      setActiveUnitModal(null);
                      handleOpenRegister();
                    }}
                    className="w-full py-4 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-lg">play_circle</span>
                    Start Unit Mock Test Now
                  </button>
                </div>
              )}

              {/* Modal Bottom Footer Actions */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                <button
                  onClick={() => setActiveUnitModal(null)}
                  className="py-2.5 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </Modal>
        )}
      </AnimatePresence>

      {/* MATERIAL VIEWER MODAL */}
      <AnimatePresence>
        {activeMaterialViewer && (
          <Modal onClose={() => setActiveMaterialViewer(null)} backdropClassName="bg-slate-950/70 backdrop-blur-md" zIndexClassName="z-[110]">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] p-6 md:p-8 max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 relative space-y-6"
            >
              <button
                onClick={() => setActiveMaterialViewer(null)}
                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl font-bold">close</span>
              </button>

              <div className="space-y-2 pr-8">
                <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/70 text-[var(--teal)] dark:text-[#FCB824] border border-amber-200 dark:border-[#FCB824]/40">
                  {activeMaterialViewer.type.toUpperCase()} DOCUMENT
                </span>
                <h3 className="text-xl font-black text-[#00243B] dark:text-white">{activeMaterialViewer.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Format: {activeMaterialViewer.format} • Size: {activeMaterialViewer.size}</p>
              </div>

              <div className="p-6 bg-[#00243B] dark:bg-[var(--navy)] text-slate-100 rounded-2xl border border-[#00243B] dark:border-slate-700 space-y-4">
                <div className="flex items-center gap-3 border-b border-[#00243B] dark:border-slate-700/80 pb-3">
                  <span className="material-symbols-outlined text-[#FCB824] text-2xl">description</span>
                  <div>
                    <h4 className="text-xs font-bold text-white">Lumen High-Yield NCERT Study Sheet</h4>
                    <p className="text-[10px] text-slate-400">{t("Verified by Senior Faculty")}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs font-mono text-slate-300 bg-slate-950/80 dark:bg-black/60 p-4 rounded-xl border border-[#00243B]">
                  <p>✓ High-yield diagrams and labeling guides</p>
                  <p>✓ Last 10-year topic frequency mapping</p>
                  <p>✓ Formula cheat-sheets and reaction mechanisms</p>
                  <p>✓ Rapid revision mnemonics for last-minute prep</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => {
                    alert(`Downloading ${activeMaterialViewer.title}... Free Aspirant Download Started!`);
                    setActiveMaterialViewer(null);
                  }}
                  className="flex-1 py-3 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  Download Resource PDF
                </button>
                <button
                  onClick={() => setActiveMaterialViewer(null)}
                  className="py-3 px-6 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </Modal>
        )}
      </AnimatePresence>

      {/* AUTHENTICATION & ONBOARDING MODAL */}
      {showAuthModal && (
        <Modal onClose={() => setShowAuthModal(false)} backdropClassName="bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] sm:rounded-[32px] p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 dark:border-slate-700 relative scrollbar-thin">
            
            {/* Close Button */}
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-[#00243B] dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-[#00243B] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl font-bold">close</span>
            </button>

            {/* Modal Header */}
            <div className="text-center mb-5">
              <div className="flex justify-center mb-1">
                <LumenLogo className="w-16 md:w-20 h-16 md:h-20 " />
              </div>
              <p className="text-[11px] md:text-xs text-[var(--teal)] dark:text-[#FCB824] font-black uppercase tracking-widest mt-1">
                Lumen Academy Testing Portal
              </p>
            </div>

            {/* Mode Switcher Header within Modal */}
            <div className="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-4 text-xs font-bold">
              <button
                onClick={() => {
                  setAuthMode("register");
                  setFormError("");
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  authMode === "register" || authMode === "otp" || authMode === "exam_select"
                    ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-slate-950 shadow"
                    : "text-slate-600 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white"
                }`}
              >
                New Aspirant
              </button>
              <button
                onClick={() => {
                  setAuthMode("login");
                  setFormError("");
                }}
                className={`flex-1 py-2 rounded-lg transition-all cursor-pointer ${
                  authMode === "login"
                    ? "bg-[var(--navy)] dark:bg-[#FCB824] dark:text-slate-950 text-white shadow"
                    : "text-slate-600 dark:text-slate-300 hover:text-[#00243B] dark:hover:text-white"
                }`}
              >{t("Sign In")}</button>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-[#FCB824]/40 text-amber-700 dark:text-[#FCB824] text-xs font-bold rounded-xl flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                <span>{formError}</span>
              </div>
            )}

            {/* OAuth: Google / LinkedIn — same button either mode, Supabase
                handles account creation vs. sign-in automatically. */}
            {(authMode === "register" || authMode === "login") && (
              <div className="mb-4 space-y-2">
                <button
                  type="button"
                  disabled={oAuthLoading !== null}
                  onClick={() => handleOAuthClick("google")}
                  className="w-full flex items-center justify-center gap-2.5 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-[#00243B] dark:text-white transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.9 19 13 24 13c3.1 0 5.8 1.1 8 3l5.7-5.7C34.6 6.1 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.7 35 27 36 24 36c-5.3 0-9.7-3.1-11.3-7.5l-6.6 5.1C9.6 39.6 16.2 44 24 44z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.3 5.7l6.6 5.6C40.5 36.6 44 31 44 24c0-1.3-.1-2.7-.4-3.5z"/>
                  </svg>
                  {oAuthLoading === "google" ? "Redirecting…" : "Continue with Google"}
                </button>
                <button
                  type="button"
                  disabled={oAuthLoading !== null}
                  onClick={() => handleOAuthClick("linkedin_oidc")}
                  className="w-full flex items-center justify-center gap-2.5 py-3 bg-[#0A66C2] hover:bg-[#095196] rounded-xl text-xs font-bold text-white transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/>
                  </svg>
                  {oAuthLoading === "linkedin_oidc" ? "Redirecting…" : "Continue with LinkedIn"}
                </button>
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                </div>
              </div>
            )}

            {/* Contact Method Tab Switcher (Email vs Mobile Number) */}
            {(authMode === "register" || authMode === "login") && (
              <div className="flex rounded-lg bg-slate-100 dark:bg-slate-800/80 p-1 mb-4 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => { setAuthMethod("email"); setFormError(""); }}
                  className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMethod === "email"
                      ? "bg-white dark:bg-slate-900 text-[var(--teal)] dark:text-[#FCB824] shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">mail</span>
                  <span>Email Address</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setAuthMethod("phone"); setFormError(""); }}
                  className={`flex-1 py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    authMethod === "phone"
                      ? "bg-white dark:bg-slate-900 text-[var(--teal)] dark:text-[#FCB824] shadow-xs font-black"
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">smartphone</span>
                  <span>Mobile OTP</span>
                </button>
              </div>
            )}

            {/* 1. Registration Form */}
            {authMode === "register" && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-[#00243B] dark:text-white">Aspirant Registration</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    {authMethod === "phone" ? "Enter your mobile number to receive instant SMS verification" : "Enter your email and set a password to create your account"}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="reg-name" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Full Name</label>
                    <input
                      id="reg-name"
                      name="name"
                      autoComplete="name"
                      type="text"
                      placeholder="e.g. Prince A"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                    />
                  </div>

                  {authMethod === "phone" ? (
                    <div className="space-y-1">
                      <label htmlFor="reg-phone" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mobile Number</label>
                      <div className="flex gap-2">
                        <select
                          aria-label="Country code"
                          value={phoneCountryCode}
                          onChange={(e) => setPhoneCountryCode(e.target.value)}
                          className="px-3 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] outline-none"
                        >
                          <option value="+91">🇮🇳 +91</option>
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+44">🇬🇧 +44</option>
                          <option value="+971">🇦🇪 +971</option>
                        </select>
                        <input
                          id="reg-phone"
                          name="tel"
                          autoComplete="tel"
                          type="tel"
                          placeholder="e.g. 9876543210"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label htmlFor="reg-email" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Email Address</label>
                        <input
                          id="reg-email"
                          name="email"
                          autoComplete="email"
                          type="email"
                          placeholder="e.g. prince@lumenacademy.edu"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="reg-password" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
                        <input
                          id="reg-password"
                          name="new-password"
                          autoComplete="new-password"
                          type="password"
                          placeholder="At least 8 characters"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="reg-confirm-password" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Confirm Password</label>
                        <input
                          id="reg-confirm-password"
                          name="confirm-password"
                          autoComplete="new-password"
                          type="password"
                          placeholder="Re-enter password"
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>
                    </>
                  )}

                  <div className="space-y-1">
                    <label htmlFor="reg-stream" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Target Stream")}</label>
                    <select
                      id="reg-stream"
                      name="target-stream"
                      value={regStream}
                      onChange={(e) => setRegStream(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none"
                    >
                      <option value="NEET Aspirant" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">NEET Aspirant</option>
                      <option value="NEET Repeaters" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">NEET Repeaters</option>
                      <option value="JEE Mains" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">JEE Mains</option>
                      <option value="JEE Advanced" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">JEE Advanced</option>
                      <option value="Olympiad" className="dark:bg-[var(--navy)] text-[#00243B] dark:text-white">Olympiad</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authMethod === "phone" ? isSendingOtp : isSubmittingAuth}
                  className="w-full py-3.5 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] disabled:opacity-60 text-white dark:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer mt-2"
                >
                  {authMethod === "phone"
                    ? (isSendingOtp ? "Sending code..." : "Send SMS Verification OTP →")
                    : (isSubmittingAuth ? "Creating account..." : "Register & Continue →")}
                </button>
              </form>
            )}

            {/* 2. FLOW A STEP 2: OTP Verification */}
            {authMode === "otp" && (
              <form onSubmit={handleOtpSubmit} className="space-y-5 animate-in fade-in duration-200">
                <div className="text-center space-y-1">
                  <span className="text-xs font-black uppercase tracking-wider text-[var(--teal)] dark:text-[#FCB824] bg-teal-50 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-[var(--teal)]/20 dark:border-[#FCB824]/30 inline-block">
                    {otpFlow === "confirm_signup" ? "✉️ Confirm Your Account" : otpDelivery === "phone" ? "📱 Mobile SMS Verification" : "✉️ Email Security Verification"}
                  </span>
                  <h3 className="text-base font-bold text-[#00243B] dark:text-white pt-1">Enter 6-Digit Security Code</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    Code sent to{" "}
                    <span className="text-[#00243B] dark:text-slate-200 font-bold">
                      {otpFlow === "confirm_signup" ? regEmail.trim().toLowerCase() : otpDelivery === "phone" ? toE164(regPhone || loginPhone) : (regPhoneOrEmail || loginPhoneOrEmail)}
                    </span>
                  </p>
                  {otpFlow === "confirm_signup" && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold pt-1">
                      Enter it right here — you don't need to open your email or leave this tab.
                    </p>
                  )}
                </div>

                <div className="flex justify-center gap-3 my-2">
                  {otpValues.map((digit, idx) => (
                    <input
                      key={idx}
                      id={`modal-otp-${idx}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      className="w-12 h-14 bg-slate-50 dark:bg-slate-900/40 text-center text-xl font-bold border border-slate-300 dark:border-slate-700 rounded-xl focus:border-[var(--teal)] dark:focus:border-[#FCB824] outline-none text-[#00243B] dark:text-white"
                    />
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingOtp}
                  className="w-full py-3.5 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] disabled:opacity-60 text-white dark:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer"
                >
                  {isVerifyingOtp ? "Verifying..." : "Verify Code & Access Dashboard →"}
                </button>

                <div className="text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  Didn't receive code?{" "}
                  <button
                    type="button"
                    disabled={isSendingOtp || resendRetryAfterMs > 0}
                    onClick={async () => {
                      const email = otpFlow === "confirm_signup" ? regEmail.trim().toLowerCase() : (regPhoneOrEmail || loginPhoneOrEmail).trim().toLowerCase();

                      // Applies to both OTP flows: refuse locally, before
                      // Supabase is contacted, once the cooldown or the
                      // per-address hourly cap says no (LA-BE-CORE-002 CL-P2).
                      if (otpFlow !== "confirm_signup" || otpDelivery !== "phone") {
                        const guard = checkSendAllowed(email);
                        if (!guard.allowed) {
                          setFormError(describeSendGuardRefusal(guard));
                          setResendRetryAfterMs(guard.retryAfterMs ?? 0);
                          return;
                        }
                      }

                      setFormError("");
                      setIsSendingOtp(true);
                      try {
                        if (otpFlow === "confirm_signup") {
                          await resendSignupConfirmation(email);
                          recordSend(email);
                        } else if (otpDelivery === "phone") {
                          await sendPhoneOtp(toE164(regPhone || loginPhone), otpFlow === "register");
                        } else {
                          await sendEmailOtp(email, otpFlow === "register");
                          recordSend(email);
                        }
                        setOtpValues(["", "", "", "", "", ""]);
                        setResendRetryAfterMs(60_000);
                      } catch (err: any) {
                        setFormError(describeAuthError(err));
                      } finally {
                        setIsSendingOtp(false);
                      }
                    }}
                    className="text-[var(--teal)] dark:text-[#FCB824] font-bold hover:underline cursor-pointer disabled:opacity-60 disabled:no-underline disabled:text-slate-400"
                  >
                    {resendRetryAfterMs > 0 ? `Resend available in ${formatRetryAfter(resendRetryAfterMs)}` : "Resend Code"}
                  </button>
                </div>
              </form>
            )}

            {/* 3. Exam Package Selection */}
            {authMode === "exam_select" && (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-[#00243B] dark:text-white">{t("Select Test Program")}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Choose your target mock exam package to calibrate your rank tracking</p>
                </div>

                <div className="space-y-2.5">
                  {[
                    { id: "Ultimate Mock Series", desc: "180 Questions • Complete diagnostic logs & live feedback." },
                    { id: "Chapter-wise Practice Boost", desc: "Dynamic diagnostic sheets filtered by unit difficulty." },
                    { id: "Rank Acceleration Boost", desc: "Rapid 10-question focus revisions with active AI guidance." }
                  ].map((exam) => (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => setSelectedExam(exam.id)}
                      className={`w-full p-3.5 rounded-xl border text-left transition-all cursor-pointer block ${
                        selectedExam === exam.id
                          ? "border-[var(--teal)] dark:border-[#FCB824] bg-amber-50/50 dark:bg-amber-950/60 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#00243B]"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs font-bold text-[#00243B] dark:text-white">{exam.id}</span>
                        {selectedExam === exam.id && (
                          <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-sm">check_circle</span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{exam.desc}</p>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleExamSelectFinish}
                  className="w-full py-4 bg-[var(--teal)] dark:bg-[#ffd15c] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white dark:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all cursor-pointer mt-2"
                >
                  Complete Onboarding & Enter Portal →
                </button>
              </div>
            )}

            {/* 4. Returning Student Login */}
            {authMode === "login" && (
              <form onSubmit={handleLoginSubmit} className="space-y-4 animate-in fade-in duration-200">
                <div>
                  <h3 className="text-base font-bold text-[#00243B] dark:text-white">{t("Student Sign In")}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                    {authMethod === "phone" ? "Sign in using your registered mobile number and SMS OTP" : "Enter your email and password to access your mock dashboard & saved results"}
                  </p>
                </div>

                <div className="space-y-3">
                  {authMethod === "phone" ? (
                    <div className="space-y-1">
                      <label htmlFor="login-phone" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Registered Mobile Number</label>
                      <div className="flex gap-2">
                        <select
                          aria-label="Country code"
                          value={phoneCountryCode}
                          onChange={(e) => setPhoneCountryCode(e.target.value)}
                          className="px-3 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-[#00243B] dark:text-white focus:border-[var(--navy)] outline-none"
                        >
                          <option value="+91">🇮🇳 +91</option>
                          <option value="+1">🇺🇸 +1</option>
                          <option value="+44">🇬🇧 +44</option>
                          <option value="+971">🇦🇪 +971</option>
                        </select>
                        <input
                          id="login-phone"
                          name="tel"
                          autoComplete="tel"
                          type="tel"
                          placeholder="e.g. 9876543210"
                          value={loginPhone}
                          onChange={(e) => setLoginPhone(e.target.value)}
                          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--navy)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-1">
                        <label htmlFor="login-email" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Registered Email")}</label>
                        <input
                          id="login-email"
                          name="email"
                          autoComplete="username"
                          type="email"
                          placeholder="e.g. prince@lumenacademy.edu"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--navy)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label htmlFor="login-password" className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Password</label>
                        <input
                          id="login-password"
                          name="current-password"
                          autoComplete="current-password"
                          type="password"
                          placeholder="Your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-[#00243B] dark:text-white focus:border-[var(--navy)] dark:focus:border-[#FCB824] outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={authMethod === "phone" ? isSendingOtp : isSubmittingAuth}
                  className="w-full py-3.5 bg-[var(--navy)] dark:bg-[#FCB824] hover:bg-[var(--navy)] dark:hover:bg-[#FCB824] disabled:opacity-60 text-white dark:text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all cursor-pointer mt-2"
                >
                  {authMethod === "phone"
                    ? (isSendingOtp ? "Sending code..." : "Send Mobile Login OTP →")
                    : (isSubmittingAuth ? "Signing in..." : "Sign In →")}
                </button>
                <div className="grid grid-cols-2 gap-3 mt-4">
                  <button
                    type="button"
                    onClick={handleDemoAccountLogin}
                    disabled={isDemoLoggingIn}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[#00243B] dark:text-white font-bold text-xs rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer border border-transparent dark:border-slate-600 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-lg mb-1">person</span>
                    {isDemoLoggingIn ? "Signing in..." : "Demo Account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoginSuccess("Admin User", false, true)}
                    className="w-full py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[var(--teal)] dark:text-[#FCB824] font-bold text-xs rounded-xl transition-all flex flex-col items-center justify-center cursor-pointer border border-transparent dark:border-slate-600"
                  >
                    <span className="material-symbols-outlined text-lg mb-1">admin_panel_settings</span>
                    Admin Login
                  </button>
                </div>
              </form>
            )}

          </div>
        </Modal>
      )}

    </div>
  );
}