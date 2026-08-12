import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Plain links, not buttons, so pagination works before hydration and every
 * page is reachable by URL.
 */
export function CoursePagination({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <nav aria-label="การแบ่งหน้า" className="flex items-center justify-center gap-1 pt-4">
      <PageLink
        href={buildHref(page - 1)}
        disabled={page <= 1}
        label="หน้าก่อนหน้า"
        icon={<ChevronLeft aria-hidden className="size-4" />}
      />

      {pages.map((value) => (
        <Link
          key={value}
          href={buildHref(value)}
          aria-current={value === page ? "page" : undefined}
          className={cn(
            "tabular flex h-9 min-w-9 items-center justify-center rounded-control border px-3 text-sm transition-colors duration-150",
            value === page
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-foreground hover:bg-background",
          )}
        >
          {value}
        </Link>
      ))}

      <PageLink
        href={buildHref(page + 1)}
        disabled={page >= totalPages}
        label="หน้าถัดไป"
        icon={<ChevronRight aria-hidden className="size-4" />}
      />
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  icon,
}: {
  href: string;
  disabled: boolean;
  label: string;
  icon: React.ReactNode;
}) {
  const classes =
    "flex h-9 items-center justify-center rounded-control border border-border px-2 transition-colors duration-150";

  if (disabled) {
    return (
      <span aria-disabled className={cn(classes, "cursor-not-allowed bg-card text-subtle")}>
        <span className="sr-only">{label}</span>
        {icon}
      </span>
    );
  }

  return (
    <Link href={href} aria-label={label} className={cn(classes, "bg-card text-foreground hover:bg-background")}>
      {icon}
    </Link>
  );
}
