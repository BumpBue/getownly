import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/** Inline notice. Separation by thin border and tint, never by shadow. */
const alertVariants = cva(
  "flex gap-3 rounded-control border px-4 py-3 text-sm leading-relaxed",
  {
    variants: {
      tone: {
        error: "border-destructive/30 bg-destructive/5 text-destructive",
        success: "border-success/30 bg-success/5 text-success",
        pending: "border-pending/30 bg-pending/5 text-pending",
        info: "border-border bg-background text-muted",
      },
    },
    defaultVariants: { tone: "info" },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, tone, ...props }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    />
  );
}
