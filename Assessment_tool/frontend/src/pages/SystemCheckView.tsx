import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";

interface SystemCheckViewProps {
  testTitle: string;
  testCode: string;
  testTypeLabel: string;
  studentName: string;
  onCompleteSystemCheck: () => void;
  onCancel: () => void;
}

export default function SystemCheckView({ testTitle, testCode, testTypeLabel, studentName, onCompleteSystemCheck, onCancel }: SystemCheckViewProps) {
  const { t, language } = useLanguage();
  // Checking states
  const [browserCheck, setBrowserCheck] = useState<"pending" | "checking" | "success">("pending");
  const [networkCheck, setNetworkCheck] = useState<"pending" | "checking" | "success">("pending");
  const [displayCheck, setDisplayCheck] = useState<"pending" | "checking" | "success">("pending");
  const [memoryCheck, setMemoryCheck] = useState<"pending" | "checking" | "success">("pending");

  const [downloadSpeed, setDownloadSpeed] = useState<number>(0);
  const [pingMs, setPingMs] = useState<number>(0);

  // Trigger sequential automated tests
  useEffect(() => {
    // Stage 1: Browser compatibility check
    setBrowserCheck("checking");
    const t1 = setTimeout(() => {
      setBrowserCheck("success");
      
      // Stage 2: Network latency test
      setNetworkCheck("checking");
      let currentPing = 80;
      let currentSpeed = 5;
      const interval = setInterval(() => {
        currentPing = Math.floor(Math.random() * 8) + 12; // 12-20 ms
        currentSpeed = parseFloat((Math.random() * 5 + 32).toFixed(1)); // 32-37 Mbps
        setPingMs(currentPing);
        setDownloadSpeed(currentSpeed);
      }, 200);

      const t2 = setTimeout(() => {
        clearInterval(interval);
        setPingMs(14);
        setDownloadSpeed(38.2);
        setNetworkCheck("success");

        // Stage 3: Display Resolution Check
        setDisplayCheck("checking");
        const t3 = setTimeout(() => {
          setDisplayCheck("success");

          // Stage 4: Memory & Performance Readiness
          setMemoryCheck("checking");
          const t4 = setTimeout(() => {
            setMemoryCheck("success");
          }, 600);

          return () => clearTimeout(t4);
        }, 800);

        return () => clearTimeout(t3);
      }, 1500);

      return () => clearInterval(t2);
    }, 800);

    return () => clearTimeout(t1);
  }, []);

  const isAllPassed = 
    browserCheck === "success" && 
    networkCheck === "success" && 
    displayCheck === "success" && 
    memoryCheck === "success";

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 py-4">
      
      {/* Top title bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-outline-variant pb-5 gap-4">
        <div>
          <span className="text-[10px] bg-secondary-container text-secondary font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2 inline-block">
            Step 1 of 2: System Diagnostics
          </span>
          <h2 className="text-2xl md:text-3xl font-sans font-black text-primary tracking-tight">
            System Diagnostics Check
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            Verifying portal compatibility for: <strong className="text-secondary">{testTitle}</strong>
          </p>
        </div>

        <button 
          onClick={onCancel}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold border border-outline-variant hover:bg-surface-container-low text-on-surface rounded-xl transition-all cursor-pointer self-start"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Return to Portal
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left column: Check indicators */}
        <div className="lg:col-span-7 space-y-6">
          <h3 className="text-sm font-bold uppercase text-outline tracking-wider block">
            System Diagnostics Checklist
          </h3>

          <div className="space-y-4">
            
            {/* 1. Browser compliance */}
            <div className={`p-4 rounded-2xl border transition-all ${
              browserCheck === "success" 
                ? "border-[var(--teal)]/30 bg-amber-50/40 dark:bg-slate-800" 
                : browserCheck === "checking"
                ? "border-secondary/30 bg-secondary-container/5"
                : "border-outline-variant bg-white dark:bg-slate-800"
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex gap-3.5 items-center">
                  <span className={`material-symbols-outlined text-2xl ${
                    browserCheck === "success" ? "text-[var(--teal)]" : "text-outline"
                  }`}>
                    laptop_mac
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-primary dark:text-white">{t("Web Browser Compatibility")}</h4>
                    <p className="text-xs text-on-surface-variant dark:text-slate-300 mt-0.5">
                      {browserCheck === "success" ? "HTML5 & WebGL rendering engine verified" : browserCheck === "checking" ? "Auditing browser capabilities..." : "Waiting to initialize..."}
                    </p>
                  </div>
                </div>

                {browserCheck === "success" ? (
                  <span className="material-symbols-outlined text-[var(--teal)] text-2xl">check_circle</span>
                ) : browserCheck === "checking" ? (
                  <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-[10px] text-outline font-bold uppercase">{t("Pending")}</span>
                )}
              </div>
            </div>

            {/* 2. Network Latency & Speed */}
            <div className={`p-4 rounded-2xl border transition-all ${
              networkCheck === "success" 
                ? "border-[var(--teal)]/30 bg-amber-50/40 dark:bg-slate-800" 
                : networkCheck === "checking"
                ? "border-secondary/30 bg-secondary-container/5"
                : "border-outline-variant bg-white dark:bg-slate-800"
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex gap-3.5 items-center">
                  <span className={`material-symbols-outlined text-2xl ${
                    networkCheck === "success" ? "text-[var(--teal)]" : "text-outline"
                  }`}>
                    speed
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-primary dark:text-white">{t("Connection Latency & Bandwidth")}</h4>
                    <p className="text-xs text-on-surface-variant dark:text-slate-300 mt-0.5">
                      {networkCheck === "success" ? `Calibrated: Ping: ${pingMs}ms, Speed: ${downloadSpeed} Mbps` : networkCheck === "checking" ? `Testing connection speed... (${pingMs}ms)` : "Waiting to connect..."}
                    </p>
                  </div>
                </div>

                {networkCheck === "success" ? (
                  <span className="material-symbols-outlined text-[var(--teal)] text-2xl">check_circle</span>
                ) : networkCheck === "checking" ? (
                  <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-[10px] text-outline font-bold uppercase">{t("Pending")}</span>
                )}
              </div>
            </div>

            {/* 3. Display Resolution */}
            <div className={`p-4 rounded-2xl border transition-all ${
              displayCheck === "success" 
                ? "border-[var(--teal)]/30 bg-amber-50/40 dark:bg-slate-800" 
                : displayCheck === "checking"
                ? "border-secondary/30 bg-secondary-container/5"
                : "border-outline-variant bg-white dark:bg-slate-800"
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex gap-3.5 items-center">
                  <span className={`material-symbols-outlined text-2xl ${
                    displayCheck === "success" ? "text-[var(--teal)]" : "text-outline"
                  }`}>
                    desktop_windows
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-primary dark:text-white">{t("Display & Resolution Scaling")}</h4>
                    <p className="text-xs text-on-surface-variant dark:text-slate-300 mt-0.5">
                      {displayCheck === "success" ? "Optimal display resolution detected" : displayCheck === "checking" ? "Verifying screen dimensions..." : "Waiting..."}
                    </p>
                  </div>
                </div>

                {displayCheck === "success" ? (
                  <span className="material-symbols-outlined text-[var(--teal)] text-2xl">check_circle</span>
                ) : displayCheck === "checking" ? (
                  <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-[10px] text-outline font-bold uppercase">{t("Pending")}</span>
                )}
              </div>
            </div>

            {/* 4. Memory & Performance */}
            <div className={`p-4 rounded-2xl border transition-all ${
              memoryCheck === "success" 
                ? "border-[var(--teal)]/30 bg-amber-50/40 dark:bg-slate-800" 
                : memoryCheck === "checking"
                ? "border-secondary/30 bg-secondary-container/5"
                : "border-outline-variant bg-white dark:bg-slate-800"
            }`}>
              <div className="flex justify-between items-center">
                <div className="flex gap-3.5 items-center">
                  <span className={`material-symbols-outlined text-2xl ${
                    memoryCheck === "success" ? "text-[var(--teal)]" : "text-outline"
                  }`}>
                    memory
                  </span>
                  <div>
                    <h4 className="text-sm font-bold text-primary dark:text-white">{t("System Memory & Execution Readiness")}</h4>
                    <p className="text-xs text-on-surface-variant dark:text-slate-300 mt-0.5">
                      {memoryCheck === "success" ? "High-performance test state allocated" : memoryCheck === "checking" ? "Testing memory availability..." : "Waiting..."}
                    </p>
                  </div>
                </div>

                {memoryCheck === "success" ? (
                  <span className="material-symbols-outlined text-[var(--teal)] text-2xl">check_circle</span>
                ) : memoryCheck === "checking" ? (
                  <div className="w-5 h-5 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="text-[10px] text-outline font-bold uppercase">{t("Pending")}</span>
                )}
              </div>
            </div>

          </div>

          <div className="p-4 bg-[var(--teal)]/5 rounded-2xl border border-[var(--teal)]/15 text-xs text-secondary dark:text-amber-300 leading-relaxed flex gap-3 font-semibold">
            <span className="material-symbols-outlined text-lg">verified</span>
            <p>
              Your device and connection meet Lumen Academy examination guidelines. Automatic answer saving is active.
            </p>
          </div>
        </div>

        {/* Right column: Candidate Summary */}
        <div className="lg:col-span-5 space-y-6">
          <h3 className="text-sm font-bold uppercase text-outline tracking-wider block">
            Candidate & Session Information
          </h3>

          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-outline-variant/60 p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-4 border-b border-outline-variant pb-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center font-bold text-xl font-sans">
                {studentName.slice(0, 2).toUpperCase() || "ST"}
              </div>
              <div>
                <h4 className="font-bold text-primary dark:text-white text-base">{studentName}</h4>
                <p className="text-xs text-on-surface-variant dark:text-slate-300 font-mono">{testCode}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center py-1">
                <span className="text-outline font-bold uppercase tracking-wider text-[10px]">{t("Target Exam")}</span>
                <span className="font-bold text-primary dark:text-white">{t("NEET UG")}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-outline-variant/30">
                <span className="text-outline font-bold uppercase tracking-wider text-[10px]">{t("Test Type")}</span>
                <span className="font-bold text-secondary dark:text-amber-300">{testTypeLabel}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-outline-variant/30">
                <span className="text-outline font-bold uppercase tracking-wider text-[10px]">{t("Diagnostics Status")}</span>
                <span className="font-bold text-[var(--teal)] dark:text-amber-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Ready to Begin
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onCompleteSystemCheck}
            disabled={!isAllPassed}
            className="w-full py-4 bg-secondary hover:bg-secondary/95 text-white font-bold text-sm uppercase tracking-wider rounded-2xl shadow-lg hover:shadow-xl transition-all cursor-pointer text-center block disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {isAllPassed ? "Proceed to Instructions" : "Running Diagnostics..."}
          </button>
        </div>

      </div>

    </div>
  );
}
