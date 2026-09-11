import React, { useState, useEffect } from 'react';
import { useLanguage } from "../../../contexts/LanguageContext";
import { motion } from "motion/react";

interface Flashcard {
  id: string;
  subject: string;
  topic: string;
  concept: string;
  content: string;
  formula?: string;
}

const FLASHCARDS: Flashcard[] = [
  {
    id: "fc1",
    subject: "Physics",
    topic: "Mechanics",
    concept: "Newton's Second Law",
    content: "The rate of change of momentum of a body is directly proportional to the applied force and takes place in the direction in which the force acts.",
    formula: "F = dp/dt = m * a"
  },
  {
    id: "fc2",
    subject: "Chemistry",
    topic: "Physical Chemistry",
    concept: "Ideal Gas Law",
    content: "The equation of state of a hypothetical ideal gas, which is a good approximation of the behavior of many gases under many conditions.",
    formula: "PV = nRT"
  },
  {
    id: "fc3",
    subject: "Biology",
    topic: "Genetics",
    concept: "Central Dogma",
    content: "The flow of genetic information within a biological system is generally from DNA to RNA to protein."
  },
  {
    id: "fc4",
    subject: "Physics",
    topic: "Electromagnetism",
    concept: "Coulomb's Law",
    content: "The electrical force between two charged bodies is directly proportional to the product of their charges and inversely proportional to the square of the distance between them.",
    formula: "F = k(q1*q2)/r²"
  },
  {
    id: "fc5",
    subject: "Biology",
    topic: "Human Physiology",
    concept: "Cardiac Cycle",
    content: "The performance of the human heart from the beginning of one heartbeat to the beginning of the next. It consists of two periods: one during which the heart muscle relaxes and refills with blood, called diastole, following a period of robust contraction and pumping of blood, called systole."
  }
];

export function DailyFlashcard() {
  const { t } = useLanguage();
  const [flashcard, setFlashcard] = useState<Flashcard | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);

  useEffect(() => {
    setFlashcard(FLASHCARDS[Math.floor(Math.random() * FLASHCARDS.length)]);
  }, []);

  if (!flashcard) return null;

  return (
    // LA-UX-REFRESH-003 H1 — this card used to be one half of a two-column row
    // with the Pomodoro timer. Round 2 (G4) removed the timer, and the card
    // inherited the full page width while keeping `h-full min-h-[380px]`: on a
    // wide screen that produced a very wide, short box whose absolutely
    // positioned flip faces stretched with it, so the concept sat marooned in
    // the middle and the back face's overflow never engaged. The flip surface
    // now has its own capped measure and a fixed height, independent of how
    // wide the container gets.
    <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824]">style</span>
            {t("Daily Flashcard")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("High-yield concept for today's review")}</p>
        </div>
        <span className={`inline-block shrink-0 text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
          flashcard.subject === 'Biology' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' :
          flashcard.subject === 'Physics' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400' :
          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
        }`}>
          {flashcard.subject} • {flashcard.topic}
        </span>
      </div>

      {/* H1 — a capped, centred reading measure with a fixed height, so the
          card reads the same whether it is in a full-width slot or a narrow
          one. The faces are absolutely positioned, so the parent must own a
          real height rather than inheriting an accidental one. */}
      <div
        className="relative cursor-pointer w-full max-w-2xl mx-auto h-[300px] sm:h-[320px]"
        style={{ perspective: 1000 }}
        role="button"
        tabIndex={0}
        aria-label={isFlipped ? "Show the concept" : "Reveal the definition"}
        onClick={() => setIsFlipped(!isFlipped)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsFlipped((prev) => !prev);
          }
        }}
      >
        <motion.div
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
          className="w-full h-full relative"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Front */}
          <div 
            className="absolute inset-0 bg-slate-50 dark:bg-[#071d2b] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center overflow-y-auto"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">{t("Concept")}</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-[#00243B] dark:text-white text-balance">{flashcard.concept}</h3>
            <p className="text-xs font-semibold text-slate-400 mt-6 flex items-center gap-1 opacity-70">
              <span className="material-symbols-outlined text-[14px]">touch_app</span> {t("Tap to flip")}
            </p>
          </div>

          {/* Back */}
          <div 
            className="absolute inset-0 bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg overflow-y-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className="text-xs font-bold opacity-80 uppercase tracking-widest mb-3 shrink-0">{t("Definition")}</span>
            <p className="text-sm md:text-base font-medium leading-relaxed mb-3 max-w-prose">{flashcard.content}</p>
            {flashcard.formula && (
              <div className="bg-white/20 dark:bg-black/10 px-4 py-2 rounded-xl mt-1 font-mono text-base font-bold tracking-wider shrink-0 max-w-full overflow-x-auto">
                {flashcard.formula}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
