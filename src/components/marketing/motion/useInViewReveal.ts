import { useEffect, useRef, useState, CSSProperties } from "react";
import { MOTION_TOKENS } from "./motionTokens";

export interface UseInViewRevealOptions {
  threshold?: number;
  delayMs?: number;
  baseDelay?: number;
  staggerInterval?: number;
  staggerIndex?: number;
  direction?: "up" | "down" | "left" | "right" | "none";
  distancePx?: number;
  once?: boolean;
}

export function useInViewReveal<T extends HTMLElement = HTMLDivElement>({
  threshold = 0.12,
  delayMs = 0,
  baseDelay,
  staggerInterval,
  staggerIndex = 0,
  direction = "up",
  distancePx = 28,
  once = true,
}: UseInViewRevealOptions = {}) {
  const ref = useRef<T>(null);
  const [isInView, setIsInView] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const effectiveDelay = baseDelay !== undefined ? baseDelay : delayMs;
  const effectiveInterval =
    staggerInterval !== undefined ? staggerInterval : MOTION_TOKENS.stagger.standard;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          if (once) observer.unobserve(el);
        } else if (!once) {
          setIsInView(false);
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once]);

  const totalDelay = effectiveDelay + staggerIndex * effectiveInterval;

  const getTransform = () => {
    if (reducedMotion || isInView) return "translate3d(0, 0, 0)";
    switch (direction) {
      case "up":
        return `translate3d(0, ${distancePx}px, 0)`;
      case "down":
        return `translate3d(0, -${distancePx}px, 0)`;
      case "left":
        return `translate3d(${distancePx}px, 0, 0)`;
      case "right":
        return `translate3d(-${distancePx}px, 0, 0)`;
      case "none":
      default:
        return "translate3d(0, 0, 0)";
    }
  };

  const style: CSSProperties = {
    opacity: isInView || reducedMotion ? 1 : 0,
    transform: getTransform(),
    transitionProperty: "opacity, transform",
    transitionDuration: reducedMotion ? "0ms" : `${MOTION_TOKENS.duration.cinematic}ms`,
    transitionTimingFunction: MOTION_TOKENS.easing.cinematic,
    transitionDelay: reducedMotion ? "0ms" : `${totalDelay}ms`,
    willChange: isInView ? "auto" : "opacity, transform",
  };

  const getStaggerStyle = (index: number): CSSProperties => {
    const delay = effectiveDelay + index * effectiveInterval;
    return {
      transitionDelay: reducedMotion ? "0ms" : `${delay}ms`,
    };
  };

  return {
    ref,
    isInView,
    isRevealed: isInView,
    style,
    getStaggerStyle,
  };
}
