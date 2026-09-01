"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Wraps a `lg:sticky` panel and marks it "stuck" once scrolling has pinned it
 * against `top`, so the panel can react - a border that reads as "this is
 * floating above the page now" rather than a shadow (CLAUDE.md limits thin
 * shadows to dropdown/popover/modal, and a card is none of those).
 *
 * Detected by watching whether the panel's own top edge has been clipped by
 * a viewport shrunk to start exactly at `top`: once it has, the browser can
 * only be showing it there because position: sticky pinned it.
 */
export function StickyPanel({
  children,
  top = 96,
  as: Tag = "div",
  className,
}: {
  children: React.ReactNode;
  /** Pixels - must match the `top-*` utility on the sticky container. */
  top?: number;
  as?: "div" | "aside";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setStuck(entry !== undefined && entry.intersectionRatio < 1),
      { threshold: [1], rootMargin: `-${top + 1}px 0px 0px 0px` },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [top]);

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      style={{ top: `${top}px` }}
      className={`lg:sticky lg:self-start rounded-card outline-2 outline-offset-4 transition-[outline-color] duration-150 ${
        stuck ? "outline-primary/20" : "outline-transparent"
      } ${className ?? ""}`}
    >
      {children}
    </Tag>
  );
}
