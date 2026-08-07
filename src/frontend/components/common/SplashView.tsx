import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import LumenLogo from './LumenLogo';

interface SplashViewProps {
  onEnter: () => void;
}

export default function SplashView({ onEnter }: SplashViewProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Raw mouse coordinates relative to window center
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  // Cursor coordinates for the spotlight effect
  const cursorX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
  const cursorY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 0);

  // Smooth spring physics for natural fluid movement
  const springConfig = { stiffness: 120, damping: 18, mass: 0.5 };
  const smoothX = useSpring(rawX, springConfig);
  const smoothY = useSpring(rawY, springConfig);

  const smoothCursorX = useSpring(cursorX, { stiffness: 300, damping: 30 });
  const smoothCursorY = useSpring(cursorY, { stiffness: 300, damping: 30 });

  // 3D rotation angles transformed from mouse offset
  const rotateX = useTransform(smoothY, [-400, 400], [18, -18]);
  const rotateY = useTransform(smoothX, [-400, 400], [-18, 18]);

  // Parallax layers translation
  const logoTranslateZ = 60;
  const textTranslateZ = 30;

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = event;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    rawX.set(clientX - centerX);
    rawY.set(clientY - centerY);

    cursorX.set(clientX);
    cursorY.set(clientY);
  };

  useEffect(() => {
    // Initial center position
    cursorX.set(window.innerWidth / 2);
    cursorY.set(window.innerHeight / 2);
  }, []);

  return (
    <div 
      className="fixed inset-0 flex flex-col items-center justify-center cursor-pointer overflow-hidden z-50 selection:bg-transparent bg-[radial-gradient(120%_90%_at_50%_30%,_#fffdf7_0%,_#F8F6EF_55%,_#efe9dc_100%)] dark:bg-[radial-gradient(120%_90%_at_50%_30%,_#08313f_0%,_#041c28_55%,_#02121b_100%)]"
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onEnter}
      style={{ perspective: 1200 }}
    >
      {/* Dynamic Cursor Spotlight Glow following mouse movement */}
      <motion.div
        className="pointer-events-none fixed -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-r from-[var(--gold)]/20 via-[var(--teal)]/20 to-sky-400/20 blur-[100px] -z-10 transition-opacity duration-300"
        style={{
          left: smoothCursorX,
          top: smoothCursorY,
          opacity: isHovered ? 0.85 : 0.4,
        }}
      />

      {/* 3D Parallax Card Layer */}
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col items-center justify-center p-8 rounded-3xl backdrop-blur-sm bg-white/5 dark:bg-slate-800/10 border border-white/10 dark:border-white/5 shadow-lg"
      >
        {/* Animated Logo Container */}
        <motion.div 
          className="jelly-logo max-w-[260px] md:max-w-[320px]"
          style={{ transform: `translateZ(${logoTranslateZ}px)` }}
          whileHover={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
        >
          <LumenLogo className="w-full h-full drop-shadow-[0_15px_30px_rgba(0,0,0,0.25)]" />
        </motion.div>

        {/* Text Container with Parallax Depth */}
        <motion.div 
          className="mt-8 text-center text-[var(--navy)] dark:text-white px-4"
          style={{ transform: `translateZ(${textTranslateZ}px)` }}
        >
          <h3 className="text-2xl md:text-3xl font-black mb-2 tracking-tight drop-shadow-sm">
            Welcome back, scholar
          </h3>
          <p className="text-sm md:text-base font-semibold opacity-85 max-w-[320px] mx-auto text-slate-700 dark:text-slate-200">
            Your progress is waiting. Let's pick up right where you left off.
          </p>

          <motion.div 
            className="mt-8 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--teal)]/10 dark:bg-[var(--teal)]/30 border border-[var(--teal)]/30 text-[var(--navy)] dark:text-sky-200 text-xs font-bold tracking-widest uppercase"
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="w-2 h-2 rounded-full bg-[#FCB824] animate-ping" />
            Click anywhere to enter portal
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
