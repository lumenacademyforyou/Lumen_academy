import React from "react";
import { useLanguage } from "../../contexts/LanguageContext";

interface DailyReminderModalProps {
  onClose: () => void;
  onTakeTest: () => void;
  studentName: string;
}

export default function DailyReminderModal({ onClose, onTakeTest, studentName }: DailyReminderModalProps) {
  const { t } = useLanguage();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#00243B]/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white w-full max-w-md rounded-[32px] p-8 md:p-10 shadow-2xl flex flex-col items-center text-center border border-slate-200 dark:border-slate-700 relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          aria-label="Close"
        >
          <span className="material-symbols-outlined">close</span>
        </button>

        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6 bg-amber-100 dark:bg-amber-900/40">
          <span className="material-symbols-outlined text-4xl text-amber-500 dark:text-amber-400" style={{ fontVariationSettings: "'FILL' 1" }}>
            notifications_active
          </span>
        </div>

        <h2 className="font-sans font-extrabold text-2xl md:text-3xl text-[#00243B] dark:text-white mb-2">
          {t("Time to Practice, ")}{studentName.split(" ")[0]}!
        </h2>
        
        <p className="text-slate-600 dark:text-slate-300 text-sm md:text-base mb-8">
          {t("You haven't attempted a mock test in over 24 hours. Consistent practice is the key to cracking NEET. Let's get back on track!")}
        </p>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={onTakeTest}
            className="w-full py-4 bg-[var(--teal)] hover:bg-[var(--teal-2)] text-white font-bold text-sm md:text-base rounded-2xl shadow-lg hover:shadow-xl transition-all"
          >
            {t("Take a Test Now")}
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm md:text-base rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {t("Maybe Later")}
          </button>
        </div>
      </div>
    </div>
  );
}
