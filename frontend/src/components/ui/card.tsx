import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The one surface in the system. Separation is a thin border and whitespace,
 * never a shadow and never a gradient (CLAUDE.md, หัวข้อ 4).
 */
const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-card border border-border bg-card", className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("border-b border-border px-5 py-4", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

/**
 * A card heading, carrying the design's gold accent rule at card scale -
 * shorter and thinner than the one SectionHeading puts beside a page section,
 * so the two read as the same mark at two levels rather than competing.
 *
 * The rule is on by default rather than opt-in because the design puts it on
 * every card heading it draws: an accent that has to be remembered at each
 * call site is one that will be missing from a third of them. `accent={false}`
 * is there for a heading that is not a section start - a title inside a modal,
 * where the surrounding chrome already does the separating.
 */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { accent?: boolean }
>(({ className, accent = true, children, ...props }, ref) => (
  <h2
    ref={ref}
    className={cn("flex items-center gap-2.5 text-base font-semibold text-foreground", className)}
    {...props}
  >
    {accent && <span aria-hidden className="h-5 w-1 shrink-0 rounded-full bg-secondary" />}
    {children}
  </h2>
));
CardTitle.displayName = "CardTitle";

const CardBody = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("px-5 py-4", className)} {...props} />
  ),
);
CardBody.displayName = "CardBody";

export { Card, CardHeader, CardTitle, CardBody };
