import { cn } from "@/lib/utils";

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The score, as a ring.
 *
 * Green when the pass mark was met and red when it was not — the same two
 * status tokens the rest of the system uses, so a result reads the same way an
 * approved slip does (CLAUDE.md, หัวข้อ 4).
 */
export function ScoreDial({ score, passed }: { score: number; passed: boolean }) {
  const clamped = Math.min(100, Math.max(0, score));
  const tone = passed ? "text-success" : "text-destructive";

  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 120 120" className="size-full" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          className="stroke-border"
        />
        <circle
          cx="60"
          cy="60"
          r={RADIUS}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - clamped / 100)}
          // Starts the arc at twelve o'clock instead of three.
          transform="rotate(-90 60 60)"
          className={cn("stroke-current transition-[stroke-dashoffset] duration-150", tone)}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("tabular text-4xl font-semibold", tone)}>{clamped}</span>
        <span className="text-sm text-muted">%</span>
      </div>
    </div>
  );
}
