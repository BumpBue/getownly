"use client";

import { useEffect, useRef, useState } from "react";

const DURATION_MS = 600;

/**
 * Counts up from 0 to `value` once, on mount or whenever `value` changes to a
 * new number - the only place in this system that animates a number with JS
 * rather than CSS, because a number cannot be tweened with a transition.
 *
 * Skips the animation entirely under `prefers-reduced-motion`.
 */
export function useCountUp(value: number): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;

    if (from === value) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }

    let frame: number;
    const start = performance.now();

    function tick(now: number) {
      const progress = Math.min(1, (now - start) / DURATION_MS);
      // ease-out cubic, matching the CSS easing used everywhere else.
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(from + (value - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    }

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return display;
}
