import { cn } from "@/lib/utils";

/** Determinate progress bar, used while a video or document uploads. */
export function Progress({
  value,
  label,
  tone = "primary",
  className,
}: {
  /** 0-100. */
  value: number;
  label?: string;
  /**
   * `secondary` is the design's gold learning-progress bar. Upload progress
   * stays `primary`: gold reads as an achievement, and a file moving across
   * the wire is not one.
   */
  tone?: "primary" | "secondary";
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>{label}</span>
          <span className="tabular">{clamped}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full border border-border bg-background"
      >
        <div
          className={cn(
            "h-full transition-[width] duration-150",
            tone === "secondary" ? "bg-secondary" : "bg-primary",
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
