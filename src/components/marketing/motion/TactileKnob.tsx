import React, { useState, useRef, useEffect } from "react";
import { MOTION_TOKENS } from "./motionTokens";

export interface TactileKnobProps {
  label: string;
  min?: number;
  max?: number;
  value?: number;
  defaultValue?: number;
  unit?: string;
  color?: string;
  size?: number;
  onChange?: (val: number) => void;
}

export const TactileKnob: React.FC<TactileKnobProps> = ({
  label,
  min = 0,
  max = 100,
  value: controlledValue,
  defaultValue = 50,
  unit = "%",
  color = "#7C5CBF",
  size = 54,
  onChange,
}) => {
  const [internalValue, setInternalValue] = useState(
    controlledValue !== undefined ? controlledValue : defaultValue
  );
  const [isDragging, setIsDragging] = useState(false);
  const knobRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startVal = useRef(defaultValue);

  const displayValue = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (controlledValue !== undefined) {
      setInternalValue(controlledValue);
    }
  }, [controlledValue]);

  // Rotation maps from -135deg (min) to +135deg (max) -> 270 deg total range
  const normalized = (displayValue - min) / (max - min);
  const angle = -135 + normalized * 270;

  // Arc calculation for SVG circular ring
  const strokeWidth = 3;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  // 270 degrees out of 360 = 0.75 arc
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - normalized * arcLength;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startY.current = e.clientY;
    startVal.current = displayValue;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.clientY;
    const stepRange = max - min;
    const deltaVal = (deltaY / 120) * stepRange;
    const clamped = Math.max(min, Math.min(max, Math.round(startVal.current + deltaVal)));
    setInternalValue(clamped);
    onChange?.(clamped);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  return (
    <div className="flex flex-col items-center select-none font-mono">
      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          width: size,
          height: size,
          transform: isDragging ? "scale(0.96)" : "scale(1)",
          transition: `transform ${MOTION_TOKENS.duration.instant}ms ${MOTION_TOKENS.easing.tactilePop}`,
        }}
        className="relative cursor-ns-resize flex items-center justify-center rounded-full bg-gradient-to-b from-[#1C2538] to-[#0A0D14] border border-[#26334D] shadow-[0_4px_16px_rgba(0,0,0,0.6)] hover:border-[#9B7FD4]/60 transition-colors"
        title={`Drag up/down to adjust ${label}: ${displayValue}${unit}`}
      >
        {/* SVG Progress Arc */}
        <svg
          className="absolute inset-0 w-full h-full -rotate-45 pointer-events-none"
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#171F2D"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Active progress track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{
              transition: isDragging
                ? "none"
                : `stroke-dashoffset ${MOTION_TOKENS.duration.instant}ms ${MOTION_TOKENS.easing.smooth}`,
              filter: `drop-shadow(0 0 3px ${color}88)`,
            }}
          />
        </svg>

        {/* Center Metal Cap */}
        <div className="w-[72%] h-[72%] rounded-full bg-gradient-to-b from-[#141A26] to-[#090C12] border border-[#2A374F] flex items-center justify-center relative shadow-inner">
          {/* Rotating Notch Pointer */}
          <div
            style={{
              transform: `rotate(${angle}deg)`,
              transition: isDragging
                ? "none"
                : `transform ${MOTION_TOKENS.duration.instant}ms ${MOTION_TOKENS.easing.smooth}`,
            }}
            className="absolute inset-0 flex items-start justify-center pt-1 pointer-events-none"
          >
            <div
              style={{ backgroundColor: color }}
              className="w-1 h-2 rounded-full shadow-[0_0_6px_rgba(124,92,191,0.8)]"
            />
          </div>
        </div>
      </div>

      {/* Label & Value Readout */}
      <span className="text-[10px] text-[#94A3B8] uppercase tracking-wider mt-1.5 font-semibold">
        {label}
      </span>
      <span
        style={{ color: isDragging ? color : "#CBD5E1" }}
        className="text-[9px] font-bold tracking-tight transition-colors"
      >
        {displayValue}
        {unit}
      </span>
    </div>
  );
};
