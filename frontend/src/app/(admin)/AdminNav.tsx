"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  BookCheck,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { SidebarLink } from "@/components/shared/SidebarLink";
import { logout } from "@/lib/auth/api";
import { adminMessages } from "@/lib/messages/admin";
import { walletMessages } from "@/lib/messages/wallet";

const LINKS = [
  { href: "/admin", icon: LayoutDashboard, label: adminMessages.nav.dashboard },
  { href: "/admin/topups", icon: Receipt, label: adminMessages.nav.topups },
  { href: "/admin/courses", icon: BookCheck, label: adminMessages.nav.courses },
  { href: "/admin/users", icon: Users, label: adminMessages.nav.users },
  { href: "/admin/categories", icon: FolderTree, label: adminMessages.nav.categories },
  { href: "/admin/content-reports", icon: ShieldAlert, label: adminMessages.nav.contentReports },
  { href: "/admin/reports", icon: BarChart3, label: adminMessages.nav.reports },
];

/**
 * Sidebar for the admin area: `primary` ground, white type, and a `secondary`
 * bar down the left of whichever item is open.
 *
 * The rows are the shared SidebarLink, so this sidebar and the instructor one
 * mark "you are here" with the same rule at the same weight - they used to
 * differ by two pixels of border for no reason anyone chose.
 */
export function AdminNav() {
  const { nav } = walletMessages.admin;
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  return (
    <aside className="flex shrink-0 flex-col gap-6 border-b border-border bg-primary px-4 py-5 text-primary-foreground lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
      <div className="flex flex-col gap-0.5">
        <Link href="/home" className="text-xl font-semibold">
          {walletMessages.nav.brand}
        </Link>
        <span className="text-xs text-secondary">{nav.role}</span>
      </div>

      <nav className="flex flex-row flex-wrap gap-1 lg:flex-1 lg:flex-col lg:flex-nowrap">
        {LINKS.map(({ href, icon: Icon, label }) => (
          <SidebarLink
            key={href}
            href={href}
            exact={href === "/admin"}
            icon={<Icon aria-hidden className="size-4" />}
          >
            {label}
          </SidebarLink>
        ))}
      </nav>

      <div className="hidden flex-col gap-1 lg:flex">
        <Link
          href="/profile"
          className="flex items-center gap-2 rounded-control px-3 py-2 text-sm text-primary-foreground/70 transition-colors duration-150 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <UserRound aria-hidden className="size-4" />
          {adminMessages.profile.title}
        </Link>

        <Link
          href="/courses"
          className="flex items-center gap-2 rounded-control px-3 py-2 text-sm text-primary-foreground/70 transition-colors duration-150 hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <ArrowRight aria-hidden className="size-4 rotate-180" />
          {nav.backToSite}
        </Link>

        <button
          type="button"
          disabled={signingOut}
          onClick={() => void signOut()}
          className="flex items-center gap-2 rounded-control px-3 py-2 text-left text-sm text-primary-foreground/70 transition-colors duration-150 hover:bg-primary-foreground/10 hover:text-primary-foreground disabled:opacity-50"
        >
          <LogOut aria-hidden className="size-4" />
          {walletMessages.nav.logout}
        </button>
      </div>
    </aside>
  );
}
