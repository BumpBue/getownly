import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The gold accent bar heading from the Stitch design - a 4px `secondary` rule
 * standing to the left of the title.
 *
 * It exists as one component rather than a copied span because it is the only
 * thing marking where one section of a page ends and the next begins: the
 * design separates blocks with thin borders and whitespace instead of shadows
 * (CLAUDE.md, หัวข้อ 4), so the bar is carrying weight that a drop shadow
 * carries elsewhere. Twenty hand-written copies would drift in height and gap
 * and quietly stop reading as the same rhythm down the page.
 *
 * `action` is the trailing slot for section-level controls - "ดูคอร์สทั้งหมด"
 * next to คอร์สแนะนำ - which wrap under the title on narrow screens rather
 * than squeezing it.
 */
/**
 * Type and bar scale together, so a page title and the section titles beneath
 * it stay distinguishable. Without this an h1 and the h2s that follow render
 * identically and the page reads as a flat list of equals.
 */
const SIZES = {
  lg: { text: "text-2xl lg:text-3xl", bar: "h-8 w-1 mt-1" },
  md: { text: "text-lg lg:text-xl", bar: "h-6 w-1 mt-0.5" },
  sm: { text: "text-base", bar: "h-5 w-1" },
} as const;

export function SectionHeading({
  title,
  subtitle,
  action,
  as: Heading = "h2",
  // Size follows the heading level by default, but is settable on its own:
  // the landing page's sections are h2 for document structure while still
  // being the largest thing on their screen, and forcing them to h1 to look
  // right would put several h1s on one page.
  size = Heading === "h1" ? "lg" : "md",
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const sizeClasses = SIZES[size];

  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {/*
          Fixed height rather than self-stretch: the bar should measure the
          title's first line, not grow with a subtitle underneath it.
        */}
        <span aria-hidden className={cn("shrink-0 rounded-full bg-secondary", sizeClasses.bar)} />
        <div>
          <Heading className={cn("font-semibold text-primary", sizeClasses.text)}>{title}</Heading>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>

      {action}
    </div>
  );
}
