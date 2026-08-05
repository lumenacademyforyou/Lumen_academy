import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  showText = true,
  size = 'md',
}) => {
  const dimensionMap = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Official Image Logo */}
      <img
        src="/logo2.png"
        alt="Lumen Academy Logo"
        className={`${dimensionMap[size]} object-contain rounded-full border border-[#FDB824]/40 shadow-sm shrink-0 bg-white/10`}
      />

      {showText && (
        <div className="flex flex-col text-left">
          <span className="font-extrabold text-base tracking-tight leading-none text-white">
            LUMEN <span className="text-[#FDB824]">ACADEMY</span>
          </span>
          <span className="text-[10px] font-semibold text-slate-300 tracking-wider uppercase mt-1">
            Super Admin
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
