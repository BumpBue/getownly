import { cn } from "@/lib/utils";

/**
 * Loading placeholder. A pulse, not a shimmer sweep: no gradients allowed
 * (CLAUDE.md, ข้อห้าม 18).
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-border", className)} />;
}
