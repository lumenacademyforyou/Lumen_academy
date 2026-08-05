import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  className = '',
}) => {
  const variantStyles: Record<BadgeVariant, string> = {
    success: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/20 font-bold',
    warning: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/20 font-bold',
    error: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/20 font-bold',
    info: 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20 font-bold',
    neutral: 'bg-slate-100 text-slate-700 border-slate-200 font-semibold',
    accent: 'bg-[#FDB824]/20 text-[#00263D] border-[#FDB824]/40 font-extrabold',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};

export default Badge;
