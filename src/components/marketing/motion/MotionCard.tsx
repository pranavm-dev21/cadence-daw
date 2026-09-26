import React, { useRef, useState } from "react";
import { MOTION_TOKENS } from "./motionTokens";
import { useInViewReveal } from "./useInViewReveal";

export interface MotionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  staggerIndex?: number;
  glowColor?: string;
  spotlightColor?: string;
  enableTilt?: boolean;
}

export const MotionCard: React.FC<MotionCardProps> = ({
  children,
  className = "",
  staggerIndex = 0,
  glowColor = "rgba(0, 245, 255, 0.12)",
  spotlightColor,
  enableTilt = true,
  style: propStyle,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: -500, y: -500 });
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const effectiveSpotlight = spotlightColor || glowColor;

  const { ref: inViewRef, style: revealStyle } = useInViewReveal<HTMLDivElement>({
    staggerIndex,
    direction: "up",
    distancePx: 24,
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (enableTilt) {
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rx = ((y - centerY) / centerY) * -4;
      const ry = ((x - centerX) / centerX) * 4;
      setTilt({ rx, ry });
    }
  };

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ rx: 0, ry: 0 });
    setMousePos({ x: -500, y: -500 });
  };

  return (
    <div
      ref={(node) => {
        // Bridge both refs
        (cardRef as any).current = node;
        (inViewRef as any).current = node;
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        ...revealStyle,
        ...propStyle,
        transform: `${revealStyle.transform || ""} perspective(1000px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
        transition: isHovered
          ? "transform 0.1s ease-out, border-color 0.2s ease, box-shadow 0.2s ease"
          : `transform 0.4s ${MOTION_TOKENS.easing.smooth}, opacity 0.6s ${MOTION_TOKENS.easing.cinematic}, border-color 0.3s ease`,
      }}
      className={`group relative rounded-2xl bg-[#090C12]/90 border border-[#1A2234] hover:border-[#00F5FF]/40 shadow-[0_12px_40px_rgba(0,0,0,0.6)] hover:shadow-[0_20px_60px_rgba(0,245,255,0.08)] overflow-hidden transition-all duration-300 ${className}`}
      {...rest}
    >
      {/* Secondary Layer: Cursor-Following Radial Spotlight */}
      <div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, ${effectiveSpotlight}, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* Top 1px Sheen highlight */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#00F5FF]/30 to-transparent opacity-40 group-hover:opacity-100 transition-opacity" />

      {/* Card Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
};
