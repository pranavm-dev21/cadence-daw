import React, { useRef, useState, useEffect } from "react";

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "subtle" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  onClick?: () => void;
  strength?: number;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  strength = 0.35,
  ...rest
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (prefersReducedMotion || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;
    setPosition({ x: Math.max(-10, Math.min(10, deltaX)), y: Math.max(-8, Math.min(8, deltaY)) });
  };

  const handleMouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const sizeClasses = {
    sm: "px-3.5 py-1.5 text-[11px] tracking-wider uppercase font-mono font-semibold",
    md: "px-5 py-2.5 text-[13px] tracking-wide font-medium",
    lg: "px-7 py-3.5 text-[14px] tracking-wide font-semibold",
  };

  const variantClasses = {
    primary:
      "relative bg-gradient-to-b from-[#00F5FF] to-[#00C2D6] text-[#06080B] font-semibold rounded-lg shadow-[0_0_30px_rgba(0,245,255,0.28)] hover:shadow-[0_0_40px_rgba(0,245,255,0.48)] border border-[#38BDF8] active:scale-[0.98] transition-shadow duration-200",
    secondary:
      "bg-[#111622]/90 hover:bg-[#161D2E] text-[#E0E7FF] border border-[#232B3E] hover:border-[#38BDF8]/50 rounded-lg backdrop-blur-md transition-colors duration-200",
    subtle:
      "bg-transparent text-[#94A3B8] hover:text-[#00F5FF] border border-transparent hover:border-[#1E293B] rounded-lg transition-colors duration-150",
    ghost:
      "bg-[#0F141F]/60 text-[#CBD5E1] hover:text-white border border-[#1E2536] hover:border-[#2D374D] rounded-lg backdrop-blur-sm",
  };

  return (
    <button
      ref={btnRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{
        transform: prefersReducedMotion ? undefined : `translate3d(${position.x}px, ${position.y}px, 0)`,
        transition: position.x === 0 ? "transform 0.4s cubic-bezier(0.25, 1, 0.5, 1)" : "transform 0.08s ease-out",
      }}
      className={`inline-flex items-center justify-center gap-2 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-[#00F5FF]/60 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
};
