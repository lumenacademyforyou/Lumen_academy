import React, { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { motion } from "motion/react";
import AnimatedCounter from "../common/AnimatedCounter";
import { TestAttempt, Question } from "../../../types";
import { BIOLOGY_QUESTIONS, CHEMISTRY_QUESTIONS, PHYSICS_QUESTIONS, ALL_QUESTIONS } from "../../../database_sample/questions";

interface TestListViewProps {
  attempts: TestAttempt[];
  isSyllabusCompleted: boolean;
  onSelectAttempt: (attempt: TestAttempt) => void;
  onStartLobby: (testId: string) => void;
  onStartCustomTest: (config: {
    title: string;
    questions: Question[];
    durationSeconds: number;
    mode: "standard" | "practice";
    subject: string;
    difficulty?: "Adaptive" | "Easy" | "Medium" | "Hard";
  }) => void;
}

// Available unit maps per subject
const UNITS_BY_SUBJECT: Record<string, string[]> = {
  Biology: [
    "Molecular Basis of Inheritance",
    "Genetics & Evolution",
    "Ecology & Environment",
    "Biotechnology & Applications"
  ],
  Chemistry: [
    "p-Block & Periodic Trends",
    "p-Block & Inorganic Chemistry",
    "Solutions & Physical Chemistry",
    "Coordination Compounds",
    "Organic Chemistry - Reactions"
  ],
  Physics: [
    "Rotational Dynamics & Mechanics",
    "Electrostatics & Capacitance",
    "Modern Physics & Dual Nature",
    "Oscillations & SHM"
  ],
  Full: [
    "Molecular Basis of Inheritance",
    "Genetics & Evolution",
    "Ecology & Environment",
    "Biotechnology & Applications",
    "p-Block & Periodic Trends",
    "p-Block & Inorganic Chemistry",
    "Solutions & Physical Chemistry",
    "Coordination Compounds",
    "Organic Chemistry - Reactions",
    "Rotational Dynamics & Mechanics",
    "Electrostatics & Capacitance",
    "Modern Physics & Dual Nature",
    "Oscillations & SHM"
  ]
};

export default function TestListView({ 

  attempts, 
  isSyllabusCompleted,
  onSelectAttempt, 
  onStartLobby, 
  onStartCustomTest 
}: TestListViewProps) {
  const { t, language } = useLanguage();
  // Calibration states for the Custom Mock Builder
  const [selectedSubject, setSelectedSubject] = useState<"Biology" | "Chemistry" | "Physics" | "Full">("Full");
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [durationMinutes, setDurationMinutes] = useState<number>(10);
  const [difficulty, setDifficulty] = useState<"Adaptive" | "Easy" | "Medium" | "Hard">("Adaptive");

  const [filterDifficulty, setFilterDifficulty] = useState<"All" | "Easy" | "Medium" | "Hard">("All");

  const mockSeries = [
    {
      id: "mock_04",
      title: "NEET Full Syllabus Mock 04",
      subject: "All Subjects",
      topics: "Physics, Chemistry, Biology Complete Syllabus",
      questions: 180,
      duration: "180 mins",
      isCompleted: true,
      difficulty: "Hard",
    },
    {
      id: "mock_05",
      title: "NEET Full Syllabus Mock 05 (720 Marks)",
      subject: "All Subjects",
      topics: "Physics, Chemistry, Biology Complete Syllabus",
      questions: 180,
      duration: "180 mins",
      isCompleted: false,
      difficulty: "Hard",
    },
    {
      id: "mock_12",
      title: "NEET Biology Mini-Mock #12",
      subject: "Biology Focus",
      topics: "Genetics, Evolution, Ecology",
      questions: 10,
      duration: "10 mins",
      isCompleted: false,
      difficulty: "Medium",
    },
    {
      id: "mock_08",
      title: "NEET Chemistry Mini-Mock #08",
      subject: "Chemistry Focus",
      topics: "p-Block Elements, Periodic Trends",
      questions: 15,
      duration: "15 mins",
      isCompleted: false,
      difficulty: "Easy",
    }
  ];

  const filteredMockSeries = filterDifficulty === "All" 
    ? mockSeries 
    : mockSeries.filter(series => series.difficulty === filterDifficulty);

  // Helper to extract questions mapping subject & unit selections
  const getFilteredQuestions = () => {
    let pool: Question[] = [];
    switch (selectedSubject) {
      case "Biology":
        pool = BIOLOGY_QUESTIONS;
        break;
      case "Chemistry":
        pool = CHEMISTRY_QUESTIONS;
        break;
      case "Physics":
        pool = PHYSICS_QUESTIONS;
        break;
      case "Full":
      default:
        pool = ALL_QUESTIONS;
        break;
    }

    if (selectedUnits.length > 0) {
      const unitFiltered = pool.filter((q) => q.unit && selectedUnits.includes(q.unit));
      return unitFiltered.length > 0 ? unitFiltered : pool;
    }
    return pool;
  };

  const toggleUnit = (unitName: string) => {
    if (selectedUnits.includes(unitName)) {
      setSelectedUnits(selectedUnits.filter((u) => u !== unitName));
    } else {
      setSelectedUnits([...selectedUnits, unitName]);
    }
  };

  const handleSubjectChange = (sub: "Biology" | "Chemistry" | "Physics" | "Full") => {
    setSelectedSubject(sub);
    setSelectedUnits([]); // Reset units selection on subject change
  };

  const handleLaunchCustom = () => {
    const rawQuestions = getFilteredQuestions();
    
    // Symmetrical random shuffle
    const shuffled = [...rawQuestions].sort(() => 0.5 - Math.random());
    const finalQuestions = shuffled.slice(0, Math.min(questionCount, shuffled.length));

    const subjectTitle = selectedSubject === "Full" ? "Full Syllabus" : selectedSubject;
    const finalMode = "standard";
    const unitsSuffix = selectedUnits.length > 0 ? ` [${selectedUnits.length} Units]` : "";
    const customTitle = `Custom ${subjectTitle} Mock${unitsSuffix}`;

    onStartCustomTest({
      title: customTitle,
      questions: finalQuestions,
      durationSeconds: durationMinutes * 60,
      mode: finalMode,
      subject: selectedSubject,
      difficulty: difficulty,
    });
  };

  // Uniform card class matching requirement 2
  const cardClassName = "bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[28px] md:rounded-[32px] border border-slate-200 dark:border-slate-700 hover:border-[var(--teal)]/40 dark:hover:border-[#FCB824]/50 shadow-sm hover:shadow-xl transition-all duration-300 p-6 md:p-8 flex flex-col justify-between";

  const activeUnitsList = UNITS_BY_SUBJECT[selectedSubject] || UNITS_BY_SUBJECT["Full"];

  return (
    <div className="space-y-8 max-w-[1280px] mx-auto animate-in fade-in duration-500">
      <div className="px-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-sans font-bold text-[#00243B] dark:text-white tracking-tight mb-1">{t("NEET Mock Test Series")}</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm">{t("Challenge yourself with high-fidelity examination environments and get instant, smart AI strategies.")}</p>
        </div>
        
        {/* Difficulty Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t("Difficulty:")}</span>
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {["All", "Easy", "Medium", "Hard"].map((level) => (
              <button
                key={level}
                onClick={() => setFilterDifficulty(level as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  filterDifficulty === level
                    ? "bg-white dark:bg-slate-600 text-[#00243B] dark:text-white shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-[#00243B] dark:hover:text-white"
                }`}
              >
                {t(level)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        
        {/* Render pre-configured mocks with standard coloring style */}
        {filteredMockSeries.map((seriesItem, idx) => {
          const attempt = attempts.find((a) => a.id === seriesItem.id);
          const hasCompleted = attempt && attempt.totalScore > 0;

          return (
            <motion.div 
              key={seriesItem.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ y: -6 }}
              transition={{ duration: 0.3, delay: idx * 0.1 }}
              className={cardClassName}
            >
              <div>
                <div className="flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/80 text-[var(--teal)] dark:text-[#FCB824] px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">
                    {t(seriesItem.subject)}
                  </span>
                  
                  {hasCompleted ? (
                    <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-[#FCB824] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1 border border-amber-200 dark:border-[#FCB824]/40">
                      <span className="material-symbols-outlined text-sm font-bold">check_circle</span>{t("Completed")}</span>
                  ) : (
                    <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-[#FCB824] px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-200 dark:border-[#FCB824]/40">{t("Available")}</span>
                  )}
                </div>

                <h3 className="text-lg md:text-xl font-bold text-[#00243B] dark:text-white mb-2">
                  {t(seriesItem.title)}
                </h3>
                
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                  <span className="font-bold text-[#00243B] dark:text-slate-100">{t("Topics:")}</span> {t(seriesItem.topics)}
                </p>

                <div className="grid grid-cols-2 gap-4 py-4 border-t border-b border-slate-200 dark:border-slate-700 mb-6 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-lg">list_alt</span>
                    <span>{seriesItem.questions} {t("Questions")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-lg">schedule</span>
                    <span>{seriesItem.duration.replace("mins", t("mins"))}</span>
                  </div>
                </div>
              </div>

              {hasCompleted ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400 font-semibold mb-0.5">{t("Your Score")}</p>
                      <p className="text-lg font-bold text-[#00243B] dark:text-white">{attempt.totalScore}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 dark:text-slate-400 font-semibold mb-0.5">{t("Accuracy")}</p>
                      <AnimatedCounter value={attempt.accuracy} suffix="%" className="text-lg font-bold text-[var(--teal)] dark:text-[#FCB824]" />
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectAttempt(attempt)}
                    className="w-full py-3.5 bg-[var(--navy)] dark:bg-[#FCB824] text-white font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-[var(--navy)] dark:hover:bg-[#FCB824] transition-colors cursor-pointer text-center block"
                  >{t("View Scorecard")}</button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    const isFullSyllabus = seriesItem.title.toLowerCase().includes("full syllabus");
                    if (isFullSyllabus && !isSyllabusCompleted) {
                      alert("Please complete all units in your Syllabus Tracker (Study Plan) to unlock Full Syllabus Mock Tests.");
                    } else if (seriesItem.id === "mock_08") {
                      alert("NEET Chemistry Mini-Mock #08 is locked. Complete the Biology focus test to unlock it!");
                    } else {
                      onStartLobby(seriesItem.id);
                    }
                  }}
                  className={`w-full py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer text-center block ${
                    (seriesItem.title.toLowerCase().includes("full syllabus") && !isSyllabusCompleted) || seriesItem.id === "mock_08"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-transparent cursor-not-allowed"
                      : "bg-[var(--teal)] dark:bg-[#FCB824] text-white hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] shadow-md hover:shadow-lg"
                  }`}
                >
                  {(seriesItem.title.toLowerCase().includes("full syllabus") && !isSyllabusCompleted)
                    ? "Locked (Complete Syllabus Tracker)"
                    : seriesItem.id === "mock_08" 
                      ? "Locked (Complete Biology First)" 
                      : "Start Mock Test"}
                </button>
              )}
            </motion.div>
          );
        })}

        {/* Custom Mock Test Generator Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ y: -6 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className={cardClassName}
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black text-[var(--teal)] dark:text-[#FCB824] uppercase tracking-wider bg-amber-50 dark:bg-amber-950/80 px-3 py-1 rounded-full border border-amber-200 dark:border-[#FCB824]/40">{t("Custom Calibration")}</span>
              <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824] text-xl font-bold animate-pulse">settings_suggest</span>
            </div>

            <h3 className="text-lg md:text-xl font-bold text-[#00243B] dark:text-white">{t("Custom Mock Builder")}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
              Design a tailored study session matching your active pacing and unit revision targets.
            </p>

            {/* Subject Selector */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Focus Subject")}</label>
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                {(["Full", "Biology", "Chemistry", "Physics"] as const).map((sub) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => handleSubjectChange(sub)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${
                      selectedSubject === sub 
                        ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm" 
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#00243B]"
                    }`}
                  >
                    {sub === "Full" ? "All" : sub.slice(0, 4)}
                  </button>
                ))}
              </div>
            </div>

            {/* Unit / Chapter Multi-Select */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Select Particular Units ({selectedUnits.length === 0 ? "All Selected" : `${selectedUnits.length} Picked`})
                </label>
                {selectedUnits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedUnits([])}
                    className="text-[10px] text-[#ffd15c] dark:text-[#FCB824] font-bold hover:underline"
                  >
                    Reset Units
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-700 scrollbar-thin">
                {activeUnitsList.map((unit) => {
                  const isSelected = selectedUnits.includes(unit);
                  return (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => toggleUnit(unit)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all cursor-pointer text-left flex items-center gap-1 ${
                        isSelected
                          ? "bg-[var(--teal)] text-white shadow-sm border border-[var(--teal)]"
                          : "bg-white dark:bg-[var(--navy)] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-[var(--teal)]/50"
                      }`}
                    >
                      <span className="material-symbols-outlined text-[12px]">
                        {isSelected ? "check_box" : "check_box_outline_blank"}
                      </span>
                      <span>{unit}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Qs and Mins Selector */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Questions")}</label>
                <select
                  value={questionCount}
                  onChange={(e) => {
                    const count = Number(e.target.value);
                    setQuestionCount(count);
                    setDurationMinutes(count);
                  }}
                  className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#00243B] dark:text-white cursor-pointer"
                >
                  <option value={10}>{t("10 Qs")}</option>
                  <option value={20}>{t("20 Qs")}</option>
                  <option value={30}>{t("30 Qs")}</option>
                  <option value={40}>{t("40 Qs")}</option>
                  <option value={50}>{t("50 Qs")}</option>
                  <option value={60}>{t("60 Qs")}</option>
                  <option value={70}>{t("70 Qs")}</option>
                  <option value={80}>{t("80 Qs")}</option>
                  <option value={90}>{t("90 Qs")}</option>
                  <option value={100}>{t("100 Qs")}</option>
                  <option value={180}>{t("180 Qs (Full)")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Duration")}</label>
                <div className="w-full bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-500 dark:text-slate-400 cursor-not-allowed">
                  {questionCount} {t("Mins (Strict)")}
                </div>
              </div>
            </div>

          </div>

          {/* Difficulty Selector */}
          <div className="space-y-1.5 pt-4">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{t("Difficulty")}</label>
            <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              {(["Adaptive", "Easy", "Medium", "Hard"] as const).map((diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setDifficulty(diff)}
                  className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer select-none ${
                    difficulty === diff 
                      ? "bg-[var(--teal)] dark:bg-[#FCB824] text-white shadow-sm" 
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#00243B]"
                  }`}
                >
                  {t(diff)}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleLaunchCustom}
            className="w-full mt-6 py-3.5 font-bold text-xs uppercase tracking-wider rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer text-center block bg-[var(--teal)] dark:bg-[#FCB824] hover:bg-[var(--teal-2)] dark:hover:bg-[#FCB824] text-white"
          >
            Launch Custom Exam
          </button>
        </motion.div>

      </div>
    </div>
  );
}
