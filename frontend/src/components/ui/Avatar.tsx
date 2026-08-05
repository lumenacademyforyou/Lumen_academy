import React from 'react';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Avatar: React.FC<AvatarProps> = ({ name, src, size = 'md' }) => {
  const sizeStyles = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-9 h-9 text-xs',
    lg: 'w-12 h-12 text-base',
  };

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeStyles[size]} rounded-[14px] object-cover border border-[#E7EAEE]`}
      />
    );
  }

  return (
    <div
      className={`${sizeStyles[size]} rounded-[14px] bg-[#00263D] text-[#FDB824] font-extrabold flex items-center justify-center border border-[#125F76] shadow-xs shrink-0`}
    >
      {initials}
    </div>
  );
};

export default Avatar;
