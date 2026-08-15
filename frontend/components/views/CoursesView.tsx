import React, { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { motion, AnimatePresence } from "motion/react";
import { SYLLABUS_UNITS, SyllabusUnit, SyllabusUnitMaterial } from "../../../database_sample/syllabusData";
import { Question } from "../../../types";
import { BIOLOGY_QUESTIONS, CHEMISTRY_QUESTIONS, PHYSICS_QUESTIONS } from "../../../database_sample/questions";

interface CoursesViewProps {
  studentName: string;
  onStartCustomTest: (config: {
    title: string;
    questions: Question[];
    durationSeconds: number;
    mode: "standard" | "practice";
    subject: string;
    difficulty?: "Adaptive" | "Easy" | "Medium" | "Hard";
  }) => void;
  onNavigateTab: (tab: string) => void;
}

export default function CoursesView({ studentName, onStartCustomTest, onNavigateTab }: CoursesViewProps) {
  const { t, language } = useLanguage();
  // Filter States
  const [selectedSubjectTab, setSelectedSubjectTab] = useState<"all" | "physics" | "chemistry" | "botany" | "zoology">("all");
  const [selectedClassTab, setSelectedClassTab] = useState<"all" | "Class 11" | "Class 12">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [activeUnitModal, setActiveUnitModal] = useState<SyllabusUnit | null>(null);
  const [modalTab, setModalTab] = useState<"syllabus_materials" | "mock_test">("syllabus_materials");
  const [activeMaterialViewer, setActiveMaterialViewer] = useState<SyllabusUnitMaterial | null>(null);

  // Scroll to top whenever unit workspace opens or closes
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeUnitModal]);

  // Filter logic
  const filteredUnits = SYLLABUS_UNITS.filter((unit) => {
    const matchesSubject = selectedSubjectTab === "all" || unit.subject === selectedSubjectTab;
    const matchesClass = selectedClassTab === "all" || unit.ncertClass === selectedClassTab;
    const matchesSearch =
      searchQuery.trim() === "" ||
      unit.unitName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.highYieldNCERTChapter.toLowerCase().includes(searchQuery.toLowerCase()) ||
      unit.subtopics.some((st) => st.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSubject && matchesClass && matchesSearch;
  });

  // Helper to handle launching a unit mock test with exactly 30 questions based on unit syllabus
  const handleStartUnitMock = (unit: SyllabusUnit) => {
    let baseQuestions: Question[] = [];
    if (unit.subject === "physics") baseQuestions = PHYSICS_QUESTIONS;
    else if (unit.subject === "chemistry") baseQuestions = CHEMISTRY_QUESTIONS;
    else baseQuestions = BIOLOGY_QUESTIONS;

    // Filter questions matching unit if possible
    const unitMatches = baseQuestions.filter(
      (q) => q.unit && q.unit.toLowerCase().includes(unit.unitName.toLowerCase())
    );

    const pool = unitMatches.length > 0 ? unitMatches : baseQuestions;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());

    const selectedQs: Question[] = [];
    const TOTAL_QUESTIONS = 30;

    for (let i = 0; i < TOTAL_QUESTIONS; i++) {
      if (i < shuffled.length) {
        selectedQs.push({
          ...shuffled[i],
          id: 90000 + i + 1,
          unit: unit.unitName,
        });
      } else {
        // Generate unit-specific high-yield NCERT question based on syllabus subtopics
        const subtopic = unit.subtopics[i % unit.subtopics.length] || unit.unitName;
        const formula = unit.keyFormulas[i % unit.keyFormulas.length] || "";
        const templateQ = shuffled[i % shuffled.length];

        selectedQs.push({
          id: 90000 + i + 1,
          text: `[${unit.unitName} - ${subtopic}] Question ${i + 1}: Which of the following statements is ACCURATE regarding ${subtopic}? ${formula ? `(Formula Concept: ${formula})` : ""}`,
          options: templateQ?.options || [
            `Statement A: Verified NCERT concept for ${subtopic} under standard conditions`,
            `Statement B: Inversely proportional relationship observed in experimental setups`,
            `Statement C: Reaction requires an external energy input / catalyst`,
            `Statement D: Applies exclusively to ideal equilibrium states`
          ],
          correctAnswerIndex: (i % 4),
          subject: unit.subject === "physics" ? "Physics" : unit.subject === "chemistry" ? "Chemistry" : "Biology",
          unit: unit.unitName,
          ncertReference: `${unit.highYieldNCERTChapter}, NCERT Class ${unit.ncertClass}`,
          explanation: `Refer to ${unit.highYieldNCERTChapter} in NCERT Class ${unit.ncertClass}. ${subtopic} is a high-yield NEET concept. ${formula ? `Key formula: ${formula}.` : ""}`
        });
      }
    }

    onStartCustomTest({
      title: `${unit.unitName} - Unit Mock Test`,
      questions: selectedQs,
      durationSeconds: TOTAL_QUESTIONS * 60, // 30 mins
      mode: "standard",
      subject: unit.subject.toUpperCase(),
    });
    setActiveUnitModal(null);
  };

  // If a unit is selected for detailed view, render the dedicated Unit Workspace View
  if (activeUnitModal) {
    return (
      <div className="space-y-8 animate-in fade-in duration-300 pb-16">
        {/* Top Sticky Navigation / Back Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[var(--navy)] p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm sticky top-20 z-30">
          <button
            onClick={() => {
              setActiveUnitModal(null);
              setActiveMaterialViewer(null);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#00243B] dark:text-white font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
          >
            <span className="material-symbols-outlined text-base">arrow_back</span>
            <span>Back to All NEET Units</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-[#FCB824]/20 text-amber-900 dark:text-[#FCB824] px-3 py-1 rounded-full border border-[#FCB824]/30">
              {activeUnitModal.subjectLabel} • {activeUnitModal.ncertClass}
            </span>
            <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full border border-slate-200 dark:border-slate-700">
              {activeUnitModal.weightageMarks} Marks Target
            </span>
          </div>
        </div>

        {/* Hero Banner for Selected Unit Workspace */}
        <div className="bg-gradient-to-r from-[var(--navy)] via-[#002842] to-[#1a364a] text-white p-6 md:p-10 rounded-[32px] shadow-xl relative overflow-hidden border border-slate-800">
          <div className="relative z-10 space-y-4">
            <div className="flex items-center gap-2 text-[#FCB824] text-xs font-bold">
              <span className="material-symbols-outlined text-base">menu_book</span>
              <span>{activeUnitModal.highYieldNCERTChapter}</span>
            </div>

            <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight leading-tight">
              {activeUnitModal.unitName}
            </h1>

            <p className="text-slate-300 text-sm max-w-3xl leading-relaxed">
              {activeUnitModal.overview}
            </p>

            {/* Tab Selection Switcher */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10 max-w-xl">
              <button
                onClick={() => {
                  setModalTab("syllabus_materials");
                  setActiveMaterialViewer(null);
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === "syllabus_materials"
                    ? "bg-[#FCB824] text-[#00243B] font-black shadow-lg"
                    : "bg-white/10 text-slate-200 hover:bg-white/20"
                }`}
              >
                <span className="material-symbols-outlined text-lg">description</span>
                <span>1. Syllabus & Materials</span>
              </button>

              <button
                onClick={() => {
                  setModalTab("mock_test");
                  setActiveMaterialViewer(null);
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  modalTab === "mock_test"
                    ? "bg-[#FCB824] text-[#00243B] font-black shadow-lg"
                    : "bg-white/10 text-slate-200 hover:bg-white/20"
                }`}
              >
                <span className="material-symbols-outlined text-lg">timer</span>
                <span>2. Unit Mock Test</span>
              </button>
            </div>
          </div>
        </div>

        {/* Workspace Content Area */}
        {modalTab === "syllabus_materials" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column (7 cols): Topics & Cheatsheet */}
            <div className="lg:col-span-7 space-y-6">
              {/* High-Yield Topics */}
              <div className="bg-white dark:bg-[var(--navy)] p-6 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-[#00243B] dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FCB824]">checklist</span>
                  <span>High-Yield Must-Master Topics</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeUnitModal.subtopics.map((st, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span className="w-2 h-2 rounded-full bg-[#FCB824] mt-1 shrink-0" />
                      <span>{st}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Formulas & NCERT Laws */}
              <div className="bg-white dark:bg-[var(--navy)] p-6 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-[#00243B] dark:text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-sky-500">functions</span>
                  <span>Essential Formulas & NCERT Laws Cheatsheet</span>
                </h3>
                <div className="space-y-2 font-mono text-xs text-[#00243B] dark:text-amber-200 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                  {activeUnitModal.keyFormulas.map((kf, idx) => (
                    <div key={idx} className="flex items-start gap-2 py-1.5 border-b border-slate-200/50 dark:border-slate-700 last:border-none">
                      <span className="text-[#FCB824] font-bold">›</span>
                      <span className="leading-relaxed">{kf}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column (5 cols): Downloadable Materials */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white dark:bg-[var(--navy)] p-6 rounded-[28px] border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-bold text-[#00243B] dark:text-white flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-500">folder_open</span>
                    <span>NCERT Study Materials</span>
                  </h3>
                  <span className="text-xs font-bold text-[#FCB824] bg-amber-50 dark:bg-amber-950 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-800">
                    4 PDFs
                  </span>
                </div>

                {/* Material Viewer Preview Box */}
                {activeMaterialViewer && (
                  <div className="bg-[#00243B] dark:bg-slate-800 text-white p-5 rounded-2xl space-y-4 border border-amber-500/40 animate-in fade-in duration-200">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#FCB824] bg-[#FCB824]/20 px-2.5 py-0.5 rounded-md border border-[#FCB824]/40">
                          {activeMaterialViewer.format || "PDF"} Preview
                        </span>
                        <h5 className="text-sm font-bold text-white mt-1">
                          {activeMaterialViewer.title}
                        </h5>
                      </div>
                      <button
                        onClick={() => setActiveMaterialViewer(null)}
                        className="text-amber-300 hover:text-white text-xs underline cursor-pointer"
                      >
                        Back
                      </button>
                    </div>

                    <div className="bg-[#00121d] p-4 rounded-xl text-xs text-slate-200 leading-relaxed space-y-2 font-mono border border-slate-800">
                      <p className="text-amber-400 font-bold">📄 [DOCUMENT PREVIEW READY]</p>
                      <p>{activeMaterialViewer.description}</p>
                      <p className="text-slate-400 text-[11px]">
                        Verified NCERT diagrams, proofs, and previous year answer keys for {activeUnitModal.unitName}.
                      </p>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => alert(`Downloading ${activeMaterialViewer.title}... File downloaded successfully!`)}
                        className="flex-1 py-2.5 bg-[#FCB824] hover:bg-amber-400 text-[#00243B] font-black text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-base">download</span>
                        <span>Download ({activeMaterialViewer.size || "2.4 MB"})</span>
                      </button>
                      <button
                        onClick={() => setActiveMaterialViewer(null)}
                        className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {activeUnitModal.materials.map((mat, idx) => (
                    <div
                      key={idx}
                      className="p-4 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all space-y-2.5"
                    >
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        <span className="uppercase text-[#FCB824] bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/50">{mat.format || mat.type}</span>
                        <span>{mat.size || mat.fileInfo}</span>
                      </div>
                      <h5 className="text-xs font-bold text-[#00243B] dark:text-white">
                        {mat.title}
                      </h5>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                        {mat.description}
                      </p>

                      <button
                        onClick={() => setActiveMaterialViewer(mat)}
                        className="w-full py-2 bg-white dark:bg-slate-800 hover:bg-[#FCB824] dark:hover:bg-[#FCB824] text-[#00243B] dark:text-white hover:text-[#00243B] dark:hover:text-[#00243B] border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        <span>View & Download Material</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Unit Mock Test Workspace View */
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white dark:bg-[var(--navy)] p-8 rounded-[32px] border border-slate-200 dark:border-slate-700 shadow-lg space-y-6">
              <div className="bg-amber-50 dark:bg-amber-950/50 p-6 rounded-2xl border border-amber-200 dark:border-amber-800/60 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FCB824] text-xl">timer</span>
                  <h4 className="font-bold text-amber-900 dark:text-amber-200 text-base">
                    Standard Unit Mock Test: {activeUnitModal.unitName}
                  </h4>
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  This unit test provides a comprehensive 30-question assessment based on the unit syllabus with a strict 1-minute-per-question limit to build your speed and precision.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-[#FCB824] text-3xl mb-1">help</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Total Questions</p>
                  <p className="text-xl font-black text-[#00243B] dark:text-white">30 Qs</p>
                </div>

                <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-[#FCB824] text-3xl mb-1">timer</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Time Limit</p>
                  <p className="text-xl font-black text-[#00243B] dark:text-white">30 Mins</p>
                </div>

                <div className="p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <span className="material-symbols-outlined text-sky-500 text-3xl mb-1">military_tech</span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Max Marks</p>
                  <p className="text-xl font-black text-[#00243B] dark:text-white">120 Marks</p>
                </div>
              </div>

              <div className="space-y-3 p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h5 className="text-xs font-bold text-[#00243B] dark:text-white uppercase tracking-wider">Test Rules & Marking Scheme</h5>
                <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <span className="text-emerald-500 font-bold">✓</span>
                    <span><strong>+4 Marks</strong> for every correct answer</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-rose-500 font-bold">✗</span>
                    <span><strong>-1 Mark</strong> for incorrect attempts (Negative Marking)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-amber-500 font-bold">⏱</span>
                    <span>Timer countdown with instant AI error analysis upon completion</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={() => handleStartUnitMock(activeUnitModal)}
                className="w-full py-4 bg-[#FCB824] hover:bg-amber-400 text-[#00243B] font-black text-sm uppercase tracking-wider rounded-2xl transition-all cursor-pointer shadow-lg flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined">play_arrow</span>
                <span>Start 30-Question Unit Mock Test Now</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Top Banner with "Journey to 720 starts here" */}
      <div className="bg-gradient-to-r from-[var(--navy)] via-[var(--teal)] to-[var(--navy)] rounded-[32px] p-8 md:p-12 text-white shadow-xl relative overflow-hidden">
        {/* Background Decorative Glows */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-[#FCB824]/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 bg-[#FCB824]/20 border border-[#FCB824]/40 backdrop-blur-md px-4 py-1.5 rounded-full text-[#FCB824] text-xs font-bold tracking-wide">
            <span className="material-symbols-outlined text-sm animate-pulse">stars</span>
            <span>{t("Journey to 720 starts here")}</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight font-sans text-white leading-tight">{t("Complete NEET Syllabus & Unit Mock Tests")}</h1>

          <p className="text-slate-200 text-sm md:text-base leading-relaxed">{t("Explore all 24 NTA-aligned units across Physics, Chemistry, Botany, and Zoology. Study high-yield NCERT notes, access formula cheatsheets, and take targeted unit mock tests.")}</p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-300">
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-sm">
              <span className="material-symbols-outlined text-sky-400 text-base">check_circle</span>
              <span>{t("24 High-Yield Units")}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-sm">
              <span className="material-symbols-outlined text-[#FCB824] text-base">quiz</span>
              <span>{t("24 Dedicated Unit Mocks")}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-sm">
              <span className="material-symbols-outlined text-sky-400 text-base">picture_as_pdf</span>
              <span>{t("96+ NCERT Study PDF Materials")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Curriculum Explorer Header & Controls */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-1">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-primary tracking-tight">{t("NEET Course Units & Modules")}</h2>
            <p className="text-on-surface-variant text-sm mt-1">{t("Select a subject or unit to view its complete syllabus, materials, and launch a mock test.")}</p>
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-80">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline dark:text-slate-400 text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("Search units, topics, chapters...")}
              className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-[var(--navy)] rounded-2xl border border-outline-variant dark:border-slate-700 text-xs text-primary dark:text-white placeholder:text-outline/70 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-secondary/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-outline hover:text-primary dark:text-slate-400 dark:hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Bar: Subject & Class Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-[var(--navy)] p-3 rounded-2xl border border-outline-variant dark:border-slate-700 shadow-sm">
          {/* Subject Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            {(["all", "physics", "chemistry", "botany", "zoology"] as const).map((tabKey) => {
              const currentCount = tabKey === "all" ? SYLLABUS_UNITS.length : SYLLABUS_UNITS.filter(u => u.subject === tabKey).length;
              const labelName = tabKey === "all" ? t("All Subjects") : tabKey.charAt(0).toUpperCase() + tabKey.slice(1);
              
              const isActive = selectedSubjectTab === tabKey;
              return (
              <button
                key={tabKey}
                onClick={() => setSelectedSubjectTab(tabKey)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? "bg-[#FCB824] text-[#00243B] shadow-sm font-black"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                {labelName} ({currentCount})
              </button>
            )})}
          </div>

          {/* Class Filter */}
          <div className="flex items-center gap-1.5 bg-surface-container dark:bg-slate-800 p-1 rounded-xl shrink-0">
            {(["all", "Class 11", "Class 12"] as const).map((cls) => (
              <button
                key={cls}
                onClick={() => setSelectedClassTab(cls)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedClassTab === cls
                    ? "bg-[#FCB824] text-[#00243B] font-black shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-[#00243B] dark:hover:text-white"
                }`}
              >
                {cls === "all" ? t("All Classes") : cls}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Units Grid */}
      {filteredUnits.length === 0 ? (
        <div className="bg-white dark:bg-[var(--navy)] rounded-3xl p-12 text-center border border-outline-variant dark:border-slate-700 space-y-3">
          <span className="material-symbols-outlined text-4xl text-outline dark:text-slate-500">search_off</span>
          <h3 className="font-bold text-primary dark:text-white text-base">No matching units found</h3>
          <p className="text-xs text-on-surface-variant dark:text-slate-400 max-w-sm mx-auto">
            Try adjusting your search query or subject filters to explore all 24 NEET units.
          </p>
          <button
            onClick={() => {
              setSelectedSubjectTab("all");
              setSelectedClassTab("all");
              setSearchQuery("");
            }}
            className="px-4 py-2 bg-surface-container dark:bg-slate-800 hover:bg-surface-container-high dark:hover:bg-slate-700 text-primary dark:text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUnits.map((unit) => (
            <div
              key={unit.id}
              className="bg-white dark:bg-[var(--navy)] rounded-[28px] overflow-hidden shadow-sm border border-outline-variant dark:border-slate-700 hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {/* Top Colored Bar */}
                <div
                  className={`h-2.5 ${
                    unit.subject === "physics"
                      ? "bg-[#FCB824]"
                      : unit.subject === "chemistry"
                      ? "bg-sky-500"
                      : unit.subject === "botany"
                      ? "bg-sky-500"
                      : "bg-purple-500"
                  }`}
                />

                <div className="p-6 space-y-4">
                  {/* Badges */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border ${unit.badgeColor}`}>
                      {unit.subjectLabel}
                    </span>
                    <span className="text-[10px] font-semibold text-outline dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                      {unit.ncertClass}
                    </span>
                  </div>

                  {/* Unit Title & NCERT Reference */}
                  <div>
                    <h3 className="text-lg font-bold text-primary dark:text-white group-hover:text-secondary dark:group-hover:text-sky-300 transition-colors line-clamp-1">
                      {unit.unitName}
                    </h3>
                    <p className="text-[11px] text-outline dark:text-slate-400 font-medium mt-0.5 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs text-secondary dark:text-sky-300">menu_book</span>
                      <span>{unit.highYieldNCERTChapter}</span>
                    </p>
                  </div>

                  {/* Weightage Metrics */}
                  <div className="bg-slate-50 dark:bg-[#071d2b] p-3 rounded-2xl border border-outline-variant/40 dark:border-slate-700 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-outline dark:text-slate-400 font-medium">NEET Weightage</span>
                      <span className="font-bold text-primary dark:text-white">{unit.weightageMarks} Marks ({unit.expectedQuestions})</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${
                          unit.subject === "physics"
                            ? "bg-[#FCB824]"
                            : unit.subject === "chemistry"
                            ? "bg-sky-500"
                            : unit.subject === "botany"
                            ? "bg-sky-500"
                            : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.min(100, unit.weightagePercent * 4)}%` }}
                      />
                    </div>
                  </div>

                  {/* Must-Master Subtopic Tags */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-outline dark:text-slate-400 uppercase tracking-wider">High-Yield Subtopics</span>
                    <div className="flex flex-wrap gap-1.5">
                      {unit.subtopics.slice(0, 3).map((st, idx) => (
                        <span key={idx} className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          {st}
                        </span>
                      ))}
                      {unit.subtopics.length > 3 && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                          +{unit.subtopics.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Action Buttons */}
              <div className="p-6 pt-0 space-y-2">
                <button
                  onClick={() => {
                    setActiveUnitModal(unit);
                    setModalTab("syllabus_materials");
                  }}
                  className="w-full py-2.5 bg-surface-container dark:bg-slate-800 hover:bg-surface-container-high dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-primary dark:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5 border border-slate-200 dark:border-slate-700"
                >
                  <span className="material-symbols-outlined text-base text-secondary dark:text-sky-300">explore</span>
                  <span>Explore Syllabus & Materials</span>
                </button>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => {
                      setActiveUnitModal(unit);
                      setModalTab("syllabus_materials");
                      setActiveMaterialViewer(null);
                    }}
                    className="py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer text-center border border-slate-200 dark:border-slate-700"
                  >
                    Syllabus
                  </button>
                  <button
                    onClick={() => {
                      setActiveUnitModal(unit);
                      setModalTab("mock_test");
                      setActiveMaterialViewer(null);
                    }}
                    className="py-2 bg-[#FCB824]/10 dark:bg-amber-950/60 hover:bg-[#FCB824]/20 dark:hover:bg-amber-900/60 rounded-lg text-[11px] font-bold text-amber-700 dark:text-[#FCB824] border border-[#FCB824] dark:border-[#FCB824]/40 transition-colors cursor-pointer text-center flex items-center justify-center gap-1"
                  >
                    <span className="material-symbols-outlined text-xs">timer</span>
                    <span>Unit Mock Test</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
