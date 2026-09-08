import React, { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { motion } from "motion/react";
import CoursesView from "./CoursesView";
import StudyPlanView from "./StudyPlanView";
import { ChapterGoal, CatalogTree, SessionResult } from "../types";

interface CourseAreaViewProps {
  studentName: string;
  chapterGoals: ChapterGoal[];
  setChapterGoals: React.Dispatch<React.SetStateAction<ChapterGoal[]>>;
  catalogTree: CatalogTree | null;
  catalogError: string | null;
  onSessionCreated: (session: SessionResult) => void;
  onNavigateTab: (tab: string) => void;
}

type CourseTab = "overview" | "neet" | "jee_mains" | "jee_advanced" | "build_study_plan";

// LA-UX-REFRESH-003 H6 — "add jee mains and jee advanced adjacently to the
// right of the neet, and remove the word syllabus from the neet syllabus."
// The NEET tab keeps everything it had; the two JEE tabs sit immediately to
// its right and are deliberately empty for now.
const TABS: { id: CourseTab; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "explore" },
  { id: "neet", label: "NEET", icon: "menu_book" },
  { id: "jee_mains", label: "JEE Mains", icon: "functions" },
  { id: "jee_advanced", label: "JEE Advanced", icon: "calculate" },
  { id: "build_study_plan", label: "Build Study Plan", icon: "edit_calendar" },
];

/**
 * H6 — the placeholder the two JEE tabs render.
 *
 * Deliberately an empty state rather than a copy of the NEET syllabus with
 * the headings swapped: there is one exam in `catalog.exam` and no JEE
 * content anywhere in the bank, so anything that looked like a JEE syllabus
 * here would be invented. The user's own instruction was to "leave blank in
 * the jee mains and advanced areas, we can add the things later" — this says
 * that plainly and points at what is available today.
 */
function ComingSoonPanel({ examName, onGoToNeet }: { examName: string; onGoToNeet: () => void }) {
  const { t } = useLanguage();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-dashed border-slate-300 dark:border-slate-600 p-10 md:p-16 text-center"
    >
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700/60 rounded-full flex items-center justify-center mx-auto mb-5">
        <span className="material-symbols-outlined text-3xl text-slate-400 dark:text-slate-300">hourglass_empty</span>
      </div>
      <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white mb-2">
        {examName} {t("is not set up yet")}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
        {t("This area is reserved for")} {examName} {t("units, materials and tests. Nothing has been added to it yet — so rather than show you a syllabus that isn't really there, it's left empty until the content lands.")}
      </p>
      <button
        onClick={onGoToNeet}
        className="mt-7 px-6 py-3 bg-[var(--navy)] text-white dark:bg-[#FCB824] dark:text-slate-900 rounded-xl font-bold text-sm hover:shadow-lg transition-all inline-flex items-center gap-2 cursor-pointer"
      >
        <span className="material-symbols-outlined text-lg">menu_book</span>
        {t("Go to NEET")}
      </button>
    </motion.div>
  );
}

export default function CourseAreaView({
  studentName,
  chapterGoals,
  setChapterGoals,
  catalogTree,
  catalogError,
  onSessionCreated,
  onNavigateTab,
}: CourseAreaViewProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<CourseTab>("overview");

  // H5 — "add a info and quick links in the course overview". Each link is a
  // real destination that already exists; nothing here routes to a dead end.
  const quickLinks: { label: string; description: string; icon: string; onClick: () => void }[] = [
    {
      label: "NEET Units",
      description: "All 4 subjects, unit by unit, with weightage and key formulas",
      icon: "menu_book",
      onClick: () => setActiveTab("neet"),
    },
    {
      label: "Build Study Plan",
      description: "Turn the units you pick into a dated, trackable plan",
      icon: "edit_calendar",
      onClick: () => setActiveTab("build_study_plan"),
    },
    {
      label: "Take a Test",
      description: "Subject practice, a full mock, or a custom paper",
      icon: "quiz",
      onClick: () => onNavigateTab("tests"),
    },
    {
      label: "Recent Test & Results",
      description: "Every attempt, its scorecard, and a PDF of the report",
      icon: "bar_chart",
      onClick: () => onNavigateTab("results"),
    },
    {
      label: "Analytics",
      description: "Accuracy trend, pacing, subject mastery and weak units",
      icon: "insights",
      onClick: () => onNavigateTab("analytics"),
    },
  ];

  return (
    <div className="w-full flex flex-col space-y-6">
      {/* Inner Navigation Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-2 min-w-max">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-bold text-sm transition-all whitespace-nowrap cursor-pointer ${
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
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {/* Intro */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8 text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="material-symbols-outlined text-4xl text-blue-600 dark:text-blue-400">local_library</span>
              </div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{t("Course Overview")}</h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                {t("Welcome to the Lumen Academy course portal. Explore the NEET syllabus unit by unit, open study materials, and build a personalised plan that tracks what you've actually covered.")}
              </p>
            </div>

            {/* H5 — info panel: what this area holds and how the pieces connect. */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--teal)] dark:text-[#FCB824] mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">info</span>
                {t("What's in here")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  {
                    icon: "menu_book",
                    title: "NEET units",
                    body: "Every unit across Physics, Chemistry, Botany and Zoology — with its NCERT class, marks weightage, expected question count, subtopics and key formulas. Each one can launch a practice test scoped to exactly that unit.",
                  },
                  {
                    icon: "edit_calendar",
                    title: "Study plan",
                    body: "Pick the units you intend to cover and turn them into dated goals. Progress is stored against your account, so it follows you across devices rather than living in one browser.",
                  },
                  {
                    icon: "insights",
                    title: "How it connects",
                    body: "Units feed the tests you take; the tests feed your analytics; the weakest units that come back out of analytics link straight to a test for that unit. It's a loop, not five separate screens.",
                  },
                ].map((item) => (
                  <div key={item.title} className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
                    <span className="material-symbols-outlined text-2xl text-[var(--teal)] dark:text-[#FCB824]">{item.icon}</span>
                    <h4 className="font-bold text-sm text-slate-800 dark:text-white mt-2 mb-1.5">{t(item.title)}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t(item.body)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* H5 — quick links. */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 md:p-8">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--teal)] dark:text-[#FCB824] mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">bolt</span>
                {t("Quick links")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {quickLinks.map((link) => (
                  <button
                    key={link.label}
                    onClick={link.onClick}
                    className="group text-left p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-[var(--navy)] dark:hover:border-[#FCB824] hover:shadow-md transition-all cursor-pointer bg-white dark:bg-slate-800"
                  >
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <span className="material-symbols-outlined text-xl text-slate-400 group-hover:text-[var(--teal)] dark:group-hover:text-[#FCB824] transition-colors">
                        {link.icon}
                      </span>
                      <span className="font-bold text-sm text-slate-800 dark:text-white">{t(link.label)}</span>
                      <span className="material-symbols-outlined text-base text-slate-300 dark:text-slate-600 ml-auto group-hover:translate-x-0.5 transition-transform">
                        arrow_forward
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t(link.description)}</p>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === "neet" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <CoursesView
              studentName={studentName}
              catalogTree={catalogTree}
              catalogError={catalogError}
              onSessionCreated={onSessionCreated}
              onNavigateTab={onNavigateTab}
            />
          </motion.div>
        )}

        {activeTab === "jee_mains" && <ComingSoonPanel examName="JEE Mains" onGoToNeet={() => setActiveTab("neet")} />}
        {activeTab === "jee_advanced" && <ComingSoonPanel examName="JEE Advanced" onGoToNeet={() => setActiveTab("neet")} />}

        {activeTab === "build_study_plan" && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <StudyPlanView
              studentName={studentName}
              chapterGoals={chapterGoals}
              setChapterGoals={setChapterGoals}
              catalogTree={catalogTree}
              onSessionCreated={onSessionCreated}
              onNavigateTab={onNavigateTab}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
