"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * One row in the instructor or admin sidebar, marked when it is the page you
 * are on.
 *
 * The design marks the active row with a gold left rule - the same accent
 * SectionHeading and CardTitle carry, turned on its side against a navy
 * ground. The tint alone would not carry it: on `primary` a slightly lighter
 * navy is nearly invisible, so the rule is what actually does the work and
 * the tint only supports it.
 *
 * `exact` is for the section root - /instructor and /admin are prefixes of
 * every other row's href, so without it they would stay lit on every page of
 * their own section and the mark would stop meaning "here".
 */
export function SidebarLink({
  href,
  icon,
  exact = false,
  children,
}: {
  href: string;
  icon: ReactNode;
  exact?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 border-l-4 py-2 pl-3 pr-3 text-sm font-medium transition-colors duration-150",
        isActive
          ? "border-secondary bg-primary-foreground/10 text-primary-foreground"
          : "border-transparent text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
