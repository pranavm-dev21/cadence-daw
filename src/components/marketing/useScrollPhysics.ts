import { useEffect, useRef } from "react";

export interface ScrollPhysicsState {
  scrollY: number;
  velocity: number;
  progress: number; // 0 to 1
  direction: "down" | "up" | "idle";
}

type PhysicsListener = (state: ScrollPhysicsState) => void;
const listeners = new Set<PhysicsListener>();

export function subscribeScrollPhysics(listener: PhysicsListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * High-performance kinetic inertia scroll engine.
 * Implements smooth spring-lerp momentum physics, velocity tracking,
 * and passes kinetic energy to visual canvas and UI layers.
 */
export function useScrollPhysics(enabled: boolean = true) {
  const stateRef = useRef<ScrollPhysicsState>({
    scrollY: 0,
    velocity: 0,
    progress: 0,
    direction: "idle",
  });

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      // Reduced motion: purely observe native scroll without momentum overriding
      const onNativeScroll = () => {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const y = window.scrollY;
        const state: ScrollPhysicsState = {
          scrollY: y,
          velocity: 0,
          progress: Math.min(1, Math.max(0, y / maxScroll)),
          direction: "idle",
        };
        stateRef.current = state;
        listeners.forEach((l) => l(state));
      };
      window.addEventListener("scroll", onNativeScroll, { passive: true });
      return () => window.removeEventListener("scroll", onNativeScroll);
    }

    let targetY = window.scrollY;
    let currentY = window.scrollY;
    let lastY = window.scrollY;
    let velocity = 0;
    let isMoving = false;
    let animId: number;

    const getMaxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    // Synchronize targetY on native/touch scroll
    const onScroll = () => {
      if (!isMoving) {
        targetY = window.scrollY;
        currentY = window.scrollY;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Kinetic Wheel Interception
    const onWheel = (e: WheelEvent) => {
      // If user is inside a scrollable child (e.g., code block or modal), let it scroll
      let target = e.target as HTMLElement | null;
      let hasScrollableParent = false;
      while (target && target !== document.body && target !== document.documentElement) {
        if (target.scrollHeight > target.clientHeight && target.clientHeight > 0) {
          const style = window.getComputedStyle(target);
          if (style.overflowY === "auto" || style.overflowY === "scroll") {
            hasScrollableParent = true;
            break;
          }
        }
        target = target.parentElement;
      }

      if (hasScrollableParent) return;

      e.preventDefault();

      // Normalize wheel delta across mouse models and touchpads
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 32; // lines
      if (e.deltaMode === 2) delta *= window.innerHeight; // pages

      // Soft clamp max step for buttery momentum
      const maxDelta = 180;
      const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta * 0.95));

      targetY = Math.max(0, Math.min(getMaxScroll(), targetY + clampedDelta));
      isMoving = true;
    };

    window.addEventListener("wheel", onWheel, { passive: false });

    // Physics Animation Loop
    const tick = () => {
      const maxScroll = getMaxScroll();
      targetY = Math.max(0, Math.min(maxScroll, targetY));

      // Damped spring-lerp (0.09 = weighty, luxurious physical instrument feel)
      const diff = targetY - currentY;
      currentY += diff * 0.092;

      // Track velocity
      velocity = currentY - lastY;
      lastY = currentY;

      if (Math.abs(diff) > 0.4 || Math.abs(velocity) > 0.1) {
        window.scrollTo(0, currentY);
        isMoving = true;
      } else {
        if (isMoving) {
          currentY = targetY;
          window.scrollTo(0, targetY);
          isMoving = false;
          velocity = 0;
        }
      }

      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, currentY / maxScroll)) : 0;
      const direction = velocity > 0.2 ? "down" : velocity < -0.2 ? "up" : "idle";

      const updatedState: ScrollPhysicsState = {
        scrollY: currentY,
        velocity,
        progress,
        direction,
      };

      stateRef.current = updatedState;
      listeners.forEach((l) => l(updatedState));

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
    };
  }, [enabled]);

  return stateRef;
}
