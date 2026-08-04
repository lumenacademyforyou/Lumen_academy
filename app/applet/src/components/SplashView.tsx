import React from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';

interface SplashViewProps {
  onEnter: () => void;
}

export default function SplashView({ onEnter }: SplashViewProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useTransform(y, [-500, 500], [25, -25]);
  const rotateY = useTransform(x, [-500, 500], [-25, 25]);

  function handleMouse(event: React.MouseEvent<HTMLDivElement, MouseEvent>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(event.clientX - centerX);
    y.set(event.clientY - centerY);
  }

  return (
    <div 
      className="fixed inset-0 bg-[var(--navy)] flex flex-col items-center justify-center cursor-pointer overflow-hidden z-50 selection:bg-transparent"
      onMouseMove={handleMouse}
      onClick={onEnter}
      style={{ perspective: 1500 }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d"
        }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center justify-center pointer-events-none w-full max-w-lg"
      >
        <motion.div style={{ transform: "translateZ(80px)" }}>
          <img 
            src="/Copy_of_Lumen_Academy_Logo.png" 
            alt="Lumen Academy" 
            className="h-48 md:h-64 lg:h-72 object-contain filter drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          />
        </motion.div>
        
        <motion.h1 
          className="text-4xl md:text-6xl font-black text-white mt-10 tracking-tight font-sans drop-shadow-lg text-center"
          style={{ transform: "translateZ(50px)" }}
        >
          LUMEN ACADEMY
        </motion.h1>

        <motion.p
          className="text-[var(--sky)] font-bold tracking-widest text-xs md:text-sm uppercase mt-4 text-center drop-shadow-md"
          style={{ transform: "translateZ(40px)" }}
        >
          AI Proctored Testing Portal
        </motion.p>
        
        <motion.div 
          className="mt-16 flex items-center justify-center gap-2 text-[var(--gold)] opacity-80"
          style={{ transform: "translateZ(20px)" }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="text-xs font-bold tracking-[0.3em] uppercase">Click anywhere to enter</span>
        </motion.div>
      </motion.div>
    </div>
  );
}
