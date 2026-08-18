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
export function SectionHeading({
  title,
  subtitle,
  action,
  as: Heading = "h2",
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="flex items-start gap-3">
        {/*
          Fixed height rather than self-stretch: the bar should measure the
          title's first line, not grow with a subtitle underneath it.
        */}
        <span aria-hidden className="mt-1 h-8 w-1 shrink-0 rounded-full bg-secondary" />
        <div>
          <Heading className="text-2xl font-semibold text-primary lg:text-3xl">{title}</Heading>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>

      {action}
    </div>
  );
}
