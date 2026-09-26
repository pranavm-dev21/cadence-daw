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
 * - On desktop: smooth spring-lerp momentum physics with velocity calculation.
 * - On mobile phones/touch screens: native 120Hz ProMotion touch scrolling, with continuous
 *   velocity tracking and energy propagation to the visual canvas & 3D console layers.
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
    const isTouch = window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window;

    // Mobile / Touch Optimization:
    // Do not intercept or override native touch scrolling. Instead, track real finger momentum
    // each animation frame and broadcast velocity to harmonic physics layers.
    if (isTouch || prefersReducedMotion) {
      let lastTouchY = window.scrollY;
      let animId: number;

      const tickTouch = () => {
        const currentY = window.scrollY;
        const rawVel = currentY - lastTouchY;
        lastTouchY = currentY;

        // Smooth velocity dampening
        const velocity = prefersReducedMotion ? 0 : rawVel * 0.85;
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const progress = Math.min(1, Math.max(0, currentY / maxScroll));
        const direction = velocity > 0.2 ? "down" : velocity < -0.2 ? "up" : "idle";

        const state: ScrollPhysicsState = {
          scrollY: currentY,
          velocity,
          progress,
          direction,
        };
        stateRef.current = state;
        listeners.forEach((l) => l(state));

        animId = requestAnimationFrame(tickTouch);
      };

      animId = requestAnimationFrame(tickTouch);
      return () => cancelAnimationFrame(animId);
    }

    // Desktop: Kinetic Spring-Lerp Inertia Scroll Engine
    let targetY = window.scrollY;
    let currentY = window.scrollY;
    let lastY = window.scrollY;
    let velocity = 0;
    let isMoving = false;
    let animId: number;

    const getMaxScroll = () =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight);

    const onScroll = () => {
      if (!isMoving) {
        targetY = window.scrollY;
        currentY = window.scrollY;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // Kinetic Wheel Interception
    const onWheel = (e: WheelEvent) => {
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

      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 32;
      if (e.deltaMode === 2) delta *= window.innerHeight;

      const maxDelta = 180;
      const clampedDelta = Math.max(-maxDelta, Math.min(maxDelta, delta * 0.95));

      targetY = Math.max(0, Math.min(getMaxScroll(), targetY + clampedDelta));
      isMoving = true;
    };

    window.addEventListener("wheel", onWheel, { passive: false });

    // Desktop Physics Loop
    const tick = () => {
      const maxScroll = getMaxScroll();
      targetY = Math.max(0, Math.min(maxScroll, targetY));

      const diff = targetY - currentY;
      currentY += diff * 0.092;

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
