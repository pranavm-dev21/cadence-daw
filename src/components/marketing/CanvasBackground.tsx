import React, { useEffect, useRef } from "react";
import { subscribeScrollPhysics, ScrollPhysicsState } from "./useScrollPhysics";

export const CanvasBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Responsive resize
    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Mouse coordinates with spring lerp
    let mouse = { x: width * 0.5, y: height * 0.4, targetX: width * 0.5, targetY: height * 0.4 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouse.targetX = e.touches[0].clientX;
        mouse.targetY = e.touches[0].clientY;
      }
    };
    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    // Track scroll physics state
    let scrollVelocity = 0;
    let scrollY = 0;
    const unsubscribeScroll = subscribeScrollPhysics((state: ScrollPhysicsState) => {
      scrollVelocity = state.velocity;
      scrollY = state.scrollY;
    });

    // Grid of subtle floating audio nodes (scaled for mobile performance)
    const isMobile = width < 640;
    const cols = isMobile ? 16 : 28;
    const rows = isMobile ? 12 : 18;
    interface Node {
      origX: number;
      origY: number;
      x: number;
      y: number;
      vx: number;
      vy: number;
      phase: number;
    }
    const nodes: Node[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const origX = (width / (cols - 1)) * c;
        const origY = (height / (rows - 1)) * r;
        nodes.push({
          origX,
          origY,
          x: origX,
          y: origY,
          vx: 0,
          vy: 0,
          phase: Math.random() * Math.PI * 2,
        });
      }
    }

    let time = 0;
    const render = () => {
      time += 0.015;

      // Spring lerp mouse
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      ctx.clearRect(0, 0, width, height);

      // Deep atmospheric ambient glow behind mouse
      const grad = ctx.createRadialGradient(
        mouse.x,
        mouse.y,
        10,
        mouse.x,
        mouse.y,
        Math.max(width, height) * 0.55
      );
      grad.addColorStop(0, "rgba(0, 245, 255, 0.045)");
      grad.addColorStop(0.35, "rgba(56, 189, 248, 0.02)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      if (prefersReducedMotion) {
        return; // static ambient glow for reduced-motion
      }

      // Smooth decay of scroll velocity influence
      const kineticForce = scrollVelocity * 0.12;

      // Update nodes with spring physics toward origin + mouse repulsion + scroll impulse
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const col = i % cols;
        const row = Math.floor(i / cols);

        // Harmonic oscillation breath
        const wave = Math.sin(time + n.phase) * 3;

        // Mouse displacement
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const maxDist = 220;

        if (dist < maxDist && dist > 0.1) {
          const force = (1 - dist / maxDist) * 18;
          n.vx += (dx / dist) * force * 0.2;
          n.vy += (dy / dist) * force * 0.2;
        }

        // Kinetic scrolling impulse with harmonic wave delay across columns
        if (Math.abs(scrollVelocity) > 0.05) {
          const wavePhase = Math.sin(col * 0.35 + time * 3);
          n.vy -= kineticForce * (0.8 + wavePhase * 0.3);
          n.vx += kineticForce * 0.05 * Math.cos(row * 0.5);
        }

        // Hooke's law spring back to original equilibrium position
        const springK = 0.042;
        const damping = 0.86;
        n.vx += (n.origX - n.x) * springK;
        n.vy += (n.origY + wave - n.y) * springK;

        n.vx *= damping;
        n.vy *= damping;

        n.x += n.vx;
        n.y += n.vy;
      }

      // Dynamic stroke color reacting to kinetic scroll velocity
      const velocityEnergy = Math.min(0.35, Math.abs(scrollVelocity) * 0.035);
      const strokeAlpha = 0.18 + velocityEnergy;
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(0, 245, 255, ${strokeAlpha})`;

      // Draw horizontal harmonic lines
      for (let r = 0; r < rows; r++) {
        ctx.beginPath();
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c;
          const n = nodes[idx];
          if (c === 0) {
            ctx.moveTo(n.x, n.y);
          } else {
            ctx.lineTo(n.x, n.y);
          }
        }
        ctx.stroke();
      }

      // Draw node particles
      for (let i = 0; i < nodes.length; i += 2) {
        const n = nodes[i];
        const distMouse = Math.hypot(n.x - mouse.x, n.y - mouse.y);
        const mouseFactor = 1 - Math.min(distMouse, 300) / 300;
        const alpha = Math.max(0.08, 0.45 * mouseFactor + velocityEnergy * 0.8);
        ctx.fillStyle = `rgba(0, 245, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.2 + velocityEnergy * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      unsubscribeScroll();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 opacity-80"
      aria-hidden="true"
    />
  );
};
