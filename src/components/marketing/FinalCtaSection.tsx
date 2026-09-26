import React, { useEffect, useRef } from "react";
import { MagneticButton } from "./MagneticButton";

interface FinalCtaSectionProps {
  onOpenCadence: () => void;
}

export const FinalCtaSection: React.FC<FinalCtaSectionProps> = ({ onOpenCadence }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const downloadUrl =
    "https://github.com/pranavm-dev21/cadence-daw/releases/download/v0.1.0/Cadence_Setup_v0.1.0.exe";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 800);
    const height = (canvas.height = 120);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
    };
    window.addEventListener("resize", handleResize);

    let phase = 0;
    const renderWaveform = () => {
      phase += 0.035;
      ctx.clearRect(0, 0, width, height);

      // Multi-layer sine harmonics simulating live audio master bus
      const layers = [
        { freq: 0.012, amp: 38, speed: 1.2, color: "rgba(0, 245, 255, 0.4)", lw: 2 },
        { freq: 0.018, amp: 26, speed: -1.0, color: "rgba(56, 189, 248, 0.25)", lw: 1.5 },
        { freq: 0.024, amp: 18, speed: 0.8, color: "rgba(167, 139, 250, 0.2)", lw: 1 },
      ];

      layers.forEach((l) => {
        ctx.beginPath();
        ctx.lineWidth = l.lw;
        ctx.strokeStyle = l.color;
        const midY = height / 2;

        for (let x = 0; x <= width; x += 4) {
          const envelope = Math.sin((x / width) * Math.PI); // Pin edges to zero
          const y = midY + Math.sin(x * l.freq + phase * l.speed) * l.amp * envelope;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      animId = requestAnimationFrame(renderWaveform);
    };

    renderWaveform();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <section className="relative py-28 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
      {/* Huge Typography */}
      <h2 className="text-4xl sm:text-7xl lg:text-8xl font-black tracking-tighter text-white uppercase leading-[0.92] mb-6">
        MAKE SOMETHING
        <br />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00F5FF] via-[#38BDF8] to-[#CBD5E1]">
          WORTH HEARING.
        </span>
      </h2>

      <p className="max-w-xl mx-auto text-[#94A3B8] text-sm sm:text-lg font-normal mb-10 leading-relaxed px-2">
        Start composing in seconds directly in your browser, or install the native Windows workstation for offline studio power.
      </p>

      {/* Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 mb-12 max-w-sm sm:max-w-none mx-auto">
        <MagneticButton size="lg" variant="primary" onClick={onOpenCadence} className="w-full sm:w-auto shadow-[0_0_35px_rgba(0,245,255,0.45)]">
          OPEN CADENCE NOW
        </MagneticButton>

        <a href={downloadUrl} download="Cadence_Setup_v0.1.0.exe" className="w-full sm:w-auto">
          <MagneticButton size="lg" variant="secondary" className="w-full sm:w-auto">
            DOWNLOAD FOR WINDOWS (.EXE)
          </MagneticButton>
        </a>
      </div>

      {/* Animated Waveform Visual Underneath */}
      <div className="relative w-full max-w-3xl mx-auto h-[120px] overflow-hidden opacity-85">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </section>
  );
};
