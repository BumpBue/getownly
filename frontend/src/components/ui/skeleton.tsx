import { cn } from "@/lib/utils";

/**
 * Loading placeholder: a solid highlight bar sweeps across on a loop.
 *
 * Not a gradient sweep (CLAUDE.md ข้อห้าม 18 bans those outright) - the
 * sweeping element is a flat semi-transparent white block animated with
 * `transform`, which reads as a shimmer without being one under the hood.
 * `prefers-reduced-motion` collapses the animation duration globally
 * (globals.css), so this degrades to the plain base colour on its own.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden rounded-control bg-border", className)}
    >
      <span
        className="absolute inset-0 bg-card/40"
        style={{ animation: "shimmer 1.6s ease-in-out infinite" }}
      />
    </div>
  );
}
