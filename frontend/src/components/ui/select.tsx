import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A native `<select>` in getownly clothing.
 *
 * Deliberately not a Radix listbox: the platform control is keyboard- and
 * screen-reader-correct for free, works on mobile, and adds no dependency
 * (CLAUDE.md, ข้อห้าม 12).
 */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 w-full appearance-none rounded-control border border-border bg-card pl-3 pr-9 text-sm text-foreground",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
          "disabled:cursor-not-allowed disabled:bg-background disabled:text-subtle",
          invalid &&
            "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
      />
    </div>
  ),
);
Select.displayName = "Select";

export { Select };
