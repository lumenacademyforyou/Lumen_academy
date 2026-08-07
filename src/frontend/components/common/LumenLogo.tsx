import React from "react";
import logoImg from "../../assets/lumen-logo.png";

interface LumenLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export default function LumenLogo({ className = "w-full h-full", style }: LumenLogoProps) {
  const [imgSrc, setImgSrc] = React.useState<string>(logoImg || "/lumen-logo.png");

  return (
    <img
      src={imgSrc}
      alt="Lumen Academy Logo"
      className={`object-contain transition-all duration-300 ${className}`}
      style={style}
      referrerPolicy="no-referrer"
      onError={() => {
        if (imgSrc !== "/lumen-logo.png") {
          setImgSrc("/lumen-logo.png");
        }
      }}
    />
  );
}


