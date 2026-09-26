import React, { useEffect, useRef } from "react";
import { MOTION_TOKENS } from "./motionTokens";

export interface SoundwaveVisualizerProps {
  isPlaying?: boolean;
  barCount?: number;
  height?: number;
  className?: string;
  color?: string;
  primaryColor?: string;
  secondaryColor?: string;
  interactive?: boolean;
}

export const SoundwaveVisualizer: React.FC<SoundwaveVisualizerProps> = ({
  isPlaying = true,
  barCount = 36,
  height = 42,
  className = "",
  color = "#00F5FF",
  primaryColor,
  secondaryColor,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);
  const effectiveColor = primaryColor || color;

  useEffect(() => {
    let animId: number;
    let phase = 0;

    const animate = () => {
      phase += isPlaying ? 0.08 : 0.02;

      barsRef.current.forEach((bar, idx) => {
        if (!bar) return;
        // Harmonic synthesis: combination of sine waves for organic sound motion
        const normalizedIdx = idx / barCount;
        const wave1 = Math.sin(phase + normalizedIdx * Math.PI * 4);
        const wave2 = Math.cos(phase * 1.4 + normalizedIdx * Math.PI * 2);
        const wave3 = Math.sin(phase * 0.7 + normalizedIdx * 10);

        let amplitude = (wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25 + 1) * 0.5;
        if (!isPlaying) {
          amplitude = Math.max(0.08, amplitude * 0.25);
        } else {
          amplitude = Math.max(0.12, Math.min(1.0, amplitude));
        }

        const barHeight = Math.round(amplitude * height);
        bar.style.height = `${barHeight}px`;

        // Secondary layer: dynamic glow intensity based on amplitude
        if (isPlaying && amplitude > 0.65) {
          bar.style.opacity = "1";
          bar.style.filter = `drop-shadow(0 0 6px ${effectiveColor})`;
          if (secondaryColor && idx % 2 === 1) {
            bar.style.backgroundColor = secondaryColor;
          }
        } else {
          bar.style.opacity = isPlaying ? "0.85" : "0.35";
          bar.style.filter = "none";
          bar.style.backgroundColor = effectiveColor;
        }
      });

      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, barCount, height, effectiveColor, secondaryColor]);

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center gap-[2px] sm:gap-[3px] select-none ${className}`}
      style={{ height: `${height}px` }}
      aria-label="Soundwave visualizer"
    >
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            if (el) barsRef.current[i] = el;
          }}
          style={{
            backgroundColor: effectiveColor,
            transition: `height ${MOTION_TOKENS.duration.instant}ms ${MOTION_TOKENS.easing.smooth}`,
          }}
          className="w-[2px] sm:w-[3px] rounded-full min-h-[3px] pointer-events-none"
        />
      ))}
    </div>
  );
};
