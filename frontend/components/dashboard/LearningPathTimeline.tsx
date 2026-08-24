import React from 'react';
import { useLanguage } from "../../contexts/LanguageContext";
import { motion } from "motion/react";

interface PathNode {
  id: string;
  subject: string;
  title: string;
  status: 'completed' | 'in-progress' | 'locked';
  progress: number;
  chaptersTotal: number;
  chaptersDone: number;
}

// Progress/status here used to be fabricated (two subjects pre-marked
// "completed" at 100% mastery, a third at 65%) and shown to every user
// regardless of whether they had ever opened a chapter — exactly the kind
// of fake history flagged for removal. No backend course-progress tracking
// exists yet (that's a separate, later piece of work), so until this reads
// real progress, every node honestly starts unearned: the first topic is
// available to begin, everything after it is locked behind it.
const LEARNING_PATH: PathNode[] = [
  {
    id: "bio_1",
    subject: "Biology",
    title: "Diversity & Structural Organization",
    status: 'in-progress',
    progress: 0,
    chaptersTotal: 7,
    chaptersDone: 0,
  },
  {
    id: "chem_1",
    subject: "Chemistry",
    title: "Physical Chemistry Basics",
    status: 'locked',
    progress: 0,
    chaptersTotal: 5,
    chaptersDone: 0,
  },
  {
    id: "phy_1",
    subject: "Physics",
    title: "Mechanics & Kinematics",
    status: 'locked',
    progress: 0,
    chaptersTotal: 8,
    chaptersDone: 0,
  },
  {
    id: "bio_2",
    subject: "Biology",
    title: "Human Physiology & Reproduction",
    status: 'locked',
    progress: 0,
    chaptersTotal: 10,
    chaptersDone: 0,
  },
  {
    id: "chem_2",
    subject: "Chemistry",
    title: "Organic Chemistry Principles",
    status: 'locked',
    progress: 0,
    chaptersTotal: 6,
    chaptersDone: 0,
  }
];

export function LearningPathTimeline() {
  const { t } = useLanguage();

  return (
    <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[32px] p-6 md:p-10 shadow-sm border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight">{t("Learning Path")}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("Your progress through core NEET subjects")}</p>
        </div>
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div><span className="text-xs font-semibold text-slate-500">{t("Completed")}</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[var(--teal)] dark:bg-[#FCB824]"></div><span className="text-xs font-semibold text-slate-500">{t("In Progress")}</span></div>
          <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-200 dark:bg-slate-700"></div><span className="text-xs font-semibold text-slate-500">{t("Locked")}</span></div>
        </div>
      </div>

      <div className="relative pl-4 md:pl-8">
        {/* Continuous vertical line */}
        <div className="absolute left-[27px] md:left-[43px] top-4 bottom-8 w-0.5 bg-slate-200 dark:bg-slate-700"></div>

        <div className="space-y-8">
          {LEARNING_PATH.map((node, idx) => {
            const isCompleted = node.status === 'completed';
            const isInProgress = node.status === 'in-progress';
            const isLocked = node.status === 'locked';

            let dotColor = 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600';
            let icon = 'lock';
            
            if (isCompleted) {
              dotColor = 'bg-emerald-500 border-emerald-400 text-white';
              icon = 'check';
            } else if (isInProgress) {
              dotColor = 'bg-[var(--teal)] dark:bg-[#FCB824] border-[var(--teal-2)] dark:border-amber-400 text-white dark:text-[#00243B]';
              icon = 'play_arrow';
            } else {
              dotColor = 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-400';
              icon = 'lock';
            }

            return (
              <motion.div 
                key={node.id}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative flex items-start gap-4 md:gap-6 group"
              >
                {/* Timeline Dot */}
                <div className={`relative z-10 w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center shrink-0 shadow-sm transition-transform duration-300 ${isInProgress ? 'scale-110 ring-4 ring-[#FCB824]/20' : 'group-hover:scale-105'} ${dotColor}`}>
                  <span className="material-symbols-outlined text-sm md:text-base font-bold">{icon}</span>
                </div>

                {/* Content Card */}
                <div className={`flex-1 rounded-2xl border p-4 md:p-5 transition-all ${
                  isLocked 
                    ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-200/50 dark:border-slate-700/50 opacity-70' 
                    : isInProgress
                      ? 'bg-white dark:bg-[#071d2b] border-[var(--teal)] dark:border-[#FCB824] shadow-md'
                      : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'
                }`}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          node.subject === 'Biology' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' :
                          node.subject === 'Physics' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400' :
                          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
                        }`}>
                          {node.subject}
                        </span>
                        {isInProgress && (
                          <span className="text-[10px] font-bold text-[var(--teal)] dark:text-[#FCB824] animate-pulse">
                            {t("CURRENT FOCUS")}
                          </span>
                        )}
                      </div>
                      <h3 className={`font-bold text-sm md:text-base ${isLocked ? 'text-slate-500 dark:text-slate-400' : 'text-[#00243B] dark:text-white'}`}>
                        {node.title}
                      </h3>
                    </div>
                    
                    <div className="flex flex-col items-start md:items-end shrink-0">
                      <span className={`text-xs font-bold ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {node.chaptersDone} / {node.chaptersTotal} {t("Chapters")}
                      </span>
                      {!isLocked && (
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">{node.progress}% {t("Mastery")}</span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        isCompleted ? 'bg-emerald-500' : isInProgress ? 'bg-[var(--teal)] dark:bg-[#FCB824]' : 'bg-transparent'
                      }`}
                      style={{ width: `${node.progress}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
