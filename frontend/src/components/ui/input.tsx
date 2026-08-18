import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Draws the field in the error state and is forwarded to aria-invalid. */
  invalid?: boolean;
  /**
   * Decorative leading glyph, as the design puts a mail icon inside the email
   * field. Purely a label for the eye - it is `aria-hidden` and does not
   * replace the Field label, which is what gets announced.
   */
  icon?: LucideIcon;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, icon: Icon, ...props }, ref) => {
    const control = (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-11 w-full rounded-control border border-border bg-card px-3 text-sm text-foreground",
          "placeholder:text-subtle transition-colors duration-150",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20",
          "disabled:cursor-not-allowed disabled:bg-background disabled:text-subtle",
          invalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
          Icon && "pl-10",
          className,
        )}
        {...props}
      />
    );

    if (!Icon) return control;

    return (
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center text-subtle">
          <Icon aria-hidden className="size-4" />
        </span>
        {control}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
