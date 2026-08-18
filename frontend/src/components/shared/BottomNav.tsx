"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GraduationCap, Home, Search, UserRound, Wallet } from "lucide-react";
import { me } from "@/lib/auth/api";
import type { UserProfile } from "@/lib/auth/types";
import { navMessages } from "@/lib/messages/nav";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/home", icon: Home, key: "home" },
  { href: "/courses", icon: Search, key: "search" },
  { href: "/my-courses", icon: GraduationCap, key: "myCourses" },
  { href: "/wallet", icon: Wallet, key: "wallet" },
  { href: "/profile", icon: UserRound, key: "profile" },
] as const;

/**
 * The design's phone bottom bar, for signed-in students only.
 *
 * Instructors and admins are deliberately excluded even though they can reach
 * some of these routes: both already have a sidebar that is their way around,
 * and a second permanent nav offering a different five destinations would
 * leave them with two competing answers to "where am I". Guests are excluded
 * because four of the five destinations would just bounce them to /login.
 *
 * Session state is resolved here rather than passed down, for the same reason
 * MainNav does it: this renders inside three different route groups -
 * (account), (public) and (student) - and none of them knows the role.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [user, setUser] = useState<UserProfile | null>(null);

  const loadUser = useCallback(async () => {
    try {
      // A guest here is ordinary, not a dead session.
      const { user: loaded } = await me({ silentOn401: true });
      setUser(loaded);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void loadUser();
    // Re-read per navigation so a sign-in or sign-out elsewhere is noticed,
    // matching how MainNav keeps itself honest.
  }, [loadUser, pathname]);

  if (user?.role !== "STUDENT") return null;

  return (
    <nav
      aria-label={navMessages.bottomNav.label}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card md:hidden"
    >
      <ul className="flex items-stretch">
        {ITEMS.map((item) => {
          const Icon = item.icon;
          // /courses must not light up for /courses/[id]; a course page is
          // somewhere you went from search, not the search tab itself.
          const isActive = pathname === item.href;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2 text-[11px] transition-colors duration-150",
                  isActive ? "font-medium text-primary" : "text-muted",
                )}
              >
                {/*
                  The active pill sits behind the icon only. Tinting the whole
                  cell would make five equal blocks read as one toolbar rather
                  than one place out of five.
                */}
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150",
                    isActive && "bg-primary/10",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                <span>{navMessages.bottomNav[item.key]}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
