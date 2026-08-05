import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Minus, type LucideProps } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  change: number;
  description: string;
  icon: React.ComponentType<LucideProps>;
  accentColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  change,
  description,
  icon: Icon,
  accentColor = '#125F76',
}) => {
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="p-6 bg-white border border-[#E7EAEE] rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 relative overflow-hidden group"
    >
      {/* Top Bar Accent */}
      <div
        className="absolute top-0 left-0 right-0 h-1.5 rounded-t-[20px]"
        style={{ backgroundColor: accentColor }}
      />

      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">
          {title}
        </span>
        <div
          className="w-10 h-10 rounded-[14px] flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="flex items-baseline justify-between">
        <h2 className="text-3xl font-black text-[#0F172A] tracking-tight font-sans">
          {value}
        </h2>

        <div
          className={`flex items-center gap-0.5 px-2.5 py-1 rounded-full text-xs font-bold ${
            isPositive
              ? 'bg-[#22C55E]/10 text-[#22C55E]'
              : isNegative
              ? 'bg-[#EF4444]/10 text-[#EF4444]'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          {isPositive ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : isNegative ? (
            <ArrowDownRight className="w-3.5 h-3.5" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
          <span>{Math.abs(change)}%</span>
        </div>
      </div>

      <p className="text-xs font-medium text-[#64748B] mt-2 leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
};

export default StatCard;
