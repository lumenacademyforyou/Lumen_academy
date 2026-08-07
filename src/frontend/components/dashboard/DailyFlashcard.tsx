import React, { useState, useEffect } from 'react';
import { useLanguage } from "../../contexts/LanguageContext";
import { motion } from "motion/react";
import { db } from "../../firebase";
import { collection, getDocs, setDoc, doc } from 'firebase/firestore';

interface Flashcard {
  id: string;
  subject: string;
  topic: string;
  concept: string;
  content: string;
  formula?: string;
}

const SEED_FLASHCARDS = [
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadFlashcard() {
      try {
        const querySnapshot = await getDocs(collection(db, 'flashcards'));
        let cards = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Flashcard));
        
        if (cards.length === 0) {
          try {
            for (const card of SEED_FLASHCARDS) {
              await setDoc(doc(db, 'flashcards', card.id), card);
            }
          } catch (e) {
            console.warn("Could not seed flashcards to DB:", e);
          }
          cards = SEED_FLASHCARDS;
        }

        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        setFlashcard(randomCard);
      } catch (e) {
        console.error("Error loading flashcard", e);
        // Fallback to local seed if DB fails (e.g. permissions)
        const randomCard = SEED_FLASHCARDS[Math.floor(Math.random() * SEED_FLASHCARDS.length)];
        setFlashcard(randomCard);
      } finally {
        setLoading(false);
      }
    }
    loadFlashcard();
  }, []);

  if (loading) {
    return (
      <div className="bg-white dark:bg-[var(--navy)] rounded-[32px] p-8 shadow-sm border border-slate-200 dark:border-slate-700 h-[380px] flex items-center justify-center animate-pulse">
        <div className="w-8 h-8 rounded-full border-4 border-[var(--teal)] border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!flashcard) return null;

  return (
    <div className="bg-white dark:bg-[var(--navy)] text-[#00243B] dark:text-white rounded-[32px] p-6 md:p-8 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col h-full min-h-[380px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-sans tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--teal)] dark:text-[#FCB824]">style</span>
            {t("Daily Flashcard")}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t("High-yield concept for today's review")}</p>
        </div>
        <span className={`hidden md:inline-block text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full ${
          flashcard.subject === 'Biology' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-400' :
          flashcard.subject === 'Physics' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400' :
          'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400'
        }`}>
          {flashcard.subject} • {flashcard.topic}
        </span>
      </div>

      <div 
        className="relative flex-1 cursor-pointer w-full"
        style={{ perspective: 1000 }}
        onClick={() => setIsFlipped(!isFlipped)}
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
            className="absolute inset-0 bg-slate-50 dark:bg-[#071d2b] border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 flex flex-col items-center justify-center text-center"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">{t("Concept")}</span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-[#00243B] dark:text-white">{flashcard.concept}</h3>
            <p className="text-xs font-semibold text-slate-400 mt-8 flex items-center gap-1 opacity-70">
              <span className="material-symbols-outlined text-[14px]">touch_app</span> {t("Tap to flip")}
            </p>
          </div>

          {/* Back */}
          <div 
            className="absolute inset-0 bg-[var(--teal)] dark:bg-[#FCB824] text-white dark:text-[#00243B] rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-lg overflow-y-auto"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <span className="text-sm font-bold opacity-80 uppercase tracking-widest mb-4">{t("Definition")}</span>
            <p className="text-base md:text-lg font-medium leading-relaxed mb-4">{flashcard.content}</p>
            {flashcard.formula && (
              <div className="bg-white/20 dark:bg-black/10 px-4 py-2 rounded-xl mt-2 font-mono text-lg font-bold tracking-wider">
                {flashcard.formula}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
