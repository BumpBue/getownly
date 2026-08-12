import Link from "next/link";
import { ArrowRight, BarChart3, Inbox, LayoutDashboard, Plus, UserRound } from "lucide-react";
import { instructorMessages } from "@/lib/messages/instructor";

/**
 * Sidebar shell for the instructor area.
 *
 * Access is enforced twice over: middleware.ts keeps other roles off these
 * URLs, and every API call behind them is checked again by NestJS. This
 * layout is presentation only.
 */
export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const { nav } = instructorMessages;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-primary px-4 py-5 text-primary-foreground lg:h-screen lg:w-64 lg:sticky lg:top-0 lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
        <div className="flex flex-col gap-0.5">
          <Link href="/" className="text-xl font-semibold">
            {nav.brand}
          </Link>
          <span className="text-xs text-secondary">{nav.role}</span>
        </div>

        <nav className="flex flex-row flex-wrap gap-1 lg:flex-1 lg:flex-col lg:flex-nowrap">
          <SidebarLink href="/instructor" icon={<LayoutDashboard aria-hidden className="size-4" />}>
            {nav.dashboard}
          </SidebarLink>
          <SidebarLink href="/instructor/courses/new" icon={<Plus aria-hidden className="size-4" />}>
            {nav.newCourse}
          </SidebarLink>
          <SidebarLink href="/instructor/qna" icon={<Inbox aria-hidden className="size-4" />}>
            {nav.qna}
          </SidebarLink>
          <SidebarLink
            href="/instructor/reports"
            icon={<BarChart3 aria-hidden className="size-4" />}
          >
            {nav.reports}
          </SidebarLink>
        </nav>

        <Link
          href="/profile"
          className="hidden items-center gap-2 rounded-control px-3 py-2 text-sm text-primary-foreground/70 transition-colors duration-150 hover:bg-primary-foreground/10 hover:text-primary-foreground lg:flex"
        >
          <UserRound aria-hidden className="size-4" />
          {nav.profile}
        </Link>

        <Link
          href="/courses"
          className="hidden items-center gap-2 rounded-control px-3 py-2 text-sm text-primary-foreground/70 transition-colors duration-150 hover:bg-primary-foreground/10 hover:text-primary-foreground lg:flex"
        >
          <ArrowRight aria-hidden className="size-4 rotate-180" />
          {nav.backToSite}
        </Link>
      </aside>

      <main className="flex-1 bg-background px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

function SidebarLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-control px-3 py-2 text-sm font-medium text-primary-foreground/85 transition-colors duration-150 hover:bg-primary-foreground/10 hover:text-primary-foreground"
    >
      {icon}
      {children}
    </Link>
  );
}
