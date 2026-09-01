import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useCountUp } from "@/hooks/use-count-up";
import { adminMessages } from "@/lib/messages/admin";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One headline number, optionally with how it moved.
 *
 * The comparison is deliberately not colour-coded as good or bad: fewer
 * suspended accounts is an improvement and fewer sales is not, and the tile
 * has no way to know which it is holding. Up is up.
 *
 * `value` is a plain number, not a pre-formatted string: it is what counts up
 * from 0 when the tile first has a real number to show. `format` turns the
 * animated number into the string actually shown, so a money tile still goes
 * through the same formatter (`formatBaht`) it always did - this component
 * never does money arithmetic, only chooses which already-computed number to
 * display mid-count.
 */
export function StatTile({
  label,
  value,
  format = formatCount,
  suffix,
  icon: Icon,
  changePercent,
  loading = false,
  footnote,
}: {
  label: string;
  value: number;
  format?: (value: number) => string;
  suffix?: string;
  icon?: LucideIcon;
  /** Undefined when this tile has no comparison; null when there is nothing to compare against. */
  changePercent?: number | null;
  loading?: boolean;
  footnote?: string;
}) {
  const { reports } = adminMessages;
  const animated = useCountUp(loading ? 0 : value);

  return (
    <div className="flex flex-col gap-3 rounded-card border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-xs text-muted">
        {Icon && <Icon aria-hidden className="size-3.5 text-secondary" />}
        {label}
      </div>

      {loading ? (
        <Skeleton className="h-9 w-28" />
      ) : (
        <p className="tabular text-2xl font-semibold text-foreground">
          {format(animated)}
          {suffix && <span className="ml-1 text-sm font-normal text-muted">{suffix}</span>}
        </p>
      )}

      {changePercent !== undefined && !loading && (
        <p className="flex items-center gap-1 text-xs">
          {changePercent === null ? (
            <span className="flex items-center gap-1 text-subtle">
              <Minus aria-hidden className="size-3.5" />
              {reports.noComparison}
            </span>
          ) : (
            <>
              <span
                className={cn(
                  "tabular flex items-center gap-0.5 font-medium",
                  changePercent >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {changePercent >= 0 ? (
                  <ArrowUpRight aria-hidden className="size-3.5" />
                ) : (
                  <ArrowDownRight aria-hidden className="size-3.5" />
                )}
                {Math.abs(changePercent)}%
              </span>
              <span className="text-subtle">{reports.comparedTo}</span>
            </>
          )}
        </p>
      )}

      {footnote && !loading && <p className="text-xs text-subtle">{footnote}</p>}
    </div>
  );
}
