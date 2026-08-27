import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  className?: string;
}

export default function AnimatedCounter({ value, suffix = "", className = "" }: AnimatedCounterProps) {
  const [hasAnimated, setHasAnimated] = useState(false);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    damping: 30,
    stiffness: 100,
  });

  useEffect(() => {
    // Small delay to ensure it triggers when navigating to the tab
    const timer = setTimeout(() => {
      motionValue.set(value);
      setHasAnimated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [value, motionValue]);

  const displayValue = useTransform(springValue, (latest) => Math.round(latest) + suffix);

  return (
    <motion.span className={className}>
      {displayValue}
    </motion.span>
  );
}
