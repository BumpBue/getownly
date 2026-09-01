import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Status pills. Each tone maps to one of the status tokens, so "เผยแพร่แล้ว"
 * is the same green everywhere in the system.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-control border px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        neutral: "border-border bg-card text-muted",
        success: "border-success/30 bg-success/5 text-success",
        pending: "border-pending/30 bg-pending/5 text-pending",
        destructive: "border-destructive/30 bg-destructive/5 text-destructive",
        accent: "border-secondary/40 bg-secondary/5 text-secondary",
        primary: "border-primary/25 bg-primary/5 text-primary",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** A small leading dot instead of leaning on the fill alone to read as a status. */
  dot?: boolean;
}

export function Badge({ className, tone, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      {children}
    </span>
  );
}
