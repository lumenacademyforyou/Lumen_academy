import React from "react";
import logoImg from "../../assets/logo.png";

interface LumenLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function LumenLogo({ className = "w-full h-full", style }: LumenLogoProps) {
  return (
    <img
      src={logoImg}
      alt="Lumen Academy Logo"
      className={`object-contain transition-all duration-300 ${className}`}
      style={style}
    />
  );
}
