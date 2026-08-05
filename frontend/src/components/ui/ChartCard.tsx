import React from 'react';
import { motion } from 'framer-motion';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, subtitle, action, children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white border border-[#E7EAEE] rounded-[20px] shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-bold text-[#0F172A] tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs font-medium text-[#64748B] mt-0.5">{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>

      <div className="w-full flex-1 min-h-[300px]">
        {children}
      </div>
    </motion.div>
  );
};

export default ChartCard;
