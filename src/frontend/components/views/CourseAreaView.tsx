import React, { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import CoursesView from "./CoursesView";
import StudyPlanView from "./StudyPlanView";
import { ChapterGoal, Question } from "../../../types";

interface CourseAreaViewProps {
  studentName: string;
  chapterGoals: ChapterGoal[];
  setChapterGoals: React.Dispatch<React.SetStateAction<ChapterGoal[]>>;
  onStartCustomTest: (config: {
    title: string;
    questions: Question[];
    durationSeconds: number;
    mode: "proctored" | "standard" | "practice";
    subject: string;
  }) => void;
  onNavigateTab: (tab: string) => void;
}

export default function CourseAreaView({
  studentName,
  chapterGoals,
  setChapterGoals,
  onStartCustomTest,
  onNavigateTab
}: CourseAreaViewProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<"overview" | "neet_syllabus" | "build_study_plan">("overview");

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Inner Navigation Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          {[
            { id: "overview", label: "Overview", icon: "explore" },
            { id: "neet_syllabus", label: "Neet Syllabus", icon: "menu_book" },
            { id: "build_study_plan", label: "Build Study Plan", icon: "edit_calendar" }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-[var(--navy)] text-white shadow-md dark:bg-slate-700 dark:text-[#FCB824]"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700/50"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              {t(tab.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="w-full">
        {activeTab === "overview" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 text-center"
          >
            <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-4xl text-blue-600 dark:text-blue-400">local_library</span>
            </div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{t("Course Overview")}</h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">{t("Welcome to the Lumen Academy Course portal. Here you can explore the complete NEET syllabus,              access comprehensive study materials, and build a personalized study plan to track your progress and achieve your goals.")}</p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <button
                onClick={() => setActiveTab("neet_syllabus")}
                className="px-6 py-3 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl font-bold text-slate-700 dark:text-slate-200 hover:border-[var(--navy)] hover:text-[var(--navy)] dark:hover:border-[#FCB824] dark:hover:text-[#FCB824] transition-colors flex items-center gap-2 shadow-sm"
              >
                <span className="material-symbols-outlined text-lg">menu_book</span>
                Explore Syllabus
              </button>
              <button
                onClick={() => setActiveTab("build_study_plan")}
                className="px-6 py-3 bg-[var(--navy)] text-white dark:bg-[#FCB824] dark:text-slate-900 rounded-xl font-bold hover:shadow-lg transition-all flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">edit_calendar</span>
                Build Study Plan
              </button>
            </div>
          </motion.div>
        )}

        {activeTab === "neet_syllabus" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <CoursesView
              studentName={studentName}
              onStartCustomTest={onStartCustomTest}
              onNavigateTab={onNavigateTab}
            />
          </motion.div>
        )}

        {activeTab === "build_study_plan" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <StudyPlanView
              studentName={studentName}
              chapterGoals={chapterGoals}
              setChapterGoals={setChapterGoals}
              onNavigateTab={onNavigateTab}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
