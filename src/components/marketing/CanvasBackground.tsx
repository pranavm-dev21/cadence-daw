import React, { useEffect, useRef } from "react";

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
    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    // Grid of subtle floating audio nodes
    const cols = 28;
    const rows = 18;
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
      const grad = ctx.createRadialGradient(mouse.x, mouse.y, 10, mouse.x, mouse.y, Math.max(width, height) * 0.55);
      grad.addColorStop(0, "rgba(0, 245, 255, 0.045)");
      grad.addColorStop(0.35, "rgba(56, 189, 248, 0.02)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      if (prefersReducedMotion) {
        return; // static ambient glow for reduced-motion
      }

      // Update nodes with spring physics toward origin + mouse repulsion
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        // Harmonic breath
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

        // Hooke's law spring back to original position
        const springK = 0.04;
        const damping = 0.88;
        n.vx += (n.origX - n.x) * springK;
        n.vy += (n.origY + wave - n.y) * springK;

        n.vx *= damping;
        n.vy *= damping;

        n.x += n.vx;
        n.y += n.vy;
      }

      // Draw subtle grid connections
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(42, 54, 78, 0.25)";

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
        const alpha = Math.max(0.08, 0.45 * (1 - Math.min(distMouse, 300) / 300));
        ctx.fillStyle = `rgba(0, 245, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
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
