"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ChevronDown, LayoutDashboard, LogOut, UserRound, Wallet } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/lib/auth/api";
import type { UserProfile } from "@/lib/auth/types";
import { adminMessages } from "@/lib/messages/admin";
import { navMessages } from "@/lib/messages/nav";
import { walletMessages } from "@/lib/messages/wallet";

/**
 * The avatar, its dropdown, and everything that decides what shows up in it.
 *
 * The three roles are not layered on top of each other: STUDENT gets wallet
 * and "my courses", INSTRUCTOR gets a dashboard link, ADMIN gets a different
 * one, and profile + logout are the only two items every role shares.
 */
export function UserMenu({ user }: { user: UserProfile }) {
  const router = useRouter();
  const { role: roleLabels } = adminMessages;
  const { userMenu: messages } = navMessages;
  const { nav } = walletMessages;

  const [signingOut, setSigningOut] = useState(false);

  const signOut = useCallback(async () => {
    if (!window.confirm(messages.logoutConfirm)) {
      return;
    }

    setSigningOut(true);
    try {
      await logout();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }, [router, messages.logoutConfirm]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={signingOut}
        className="flex items-center gap-2 rounded-control px-2 py-1.5 text-left transition-colors duration-150 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
      >
        <Avatar src={user.avatarUrl} name={user.displayName} size="sm" />
        <span className="hidden flex-col leading-tight lg:flex">
          <span className="line-clamp-1 text-sm font-medium text-foreground">
            {user.displayName}
          </span>
          <span className="text-xs text-muted">{roleLabels[user.role]}</span>
        </span>
        <ChevronDown aria-hidden className="hidden size-4 shrink-0 text-subtle lg:block" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar src={user.avatarUrl} name={user.displayName} size="md" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-1 text-sm font-semibold text-foreground">
              {user.displayName}
            </p>
            <p className="line-clamp-1 text-xs text-muted">{user.email}</p>
            <Badge tone={user.role === "ADMIN" ? "primary" : "neutral"} className="mt-1">
              {roleLabels[user.role]}
            </Badge>
          </div>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound aria-hidden className="size-4" />
            {adminMessages.profile.title}
          </Link>
        </DropdownMenuItem>

        {user.role === "STUDENT" && (
          <DropdownMenuItem asChild>
            <Link href="/wallet">
              <Wallet aria-hidden className="size-4" />
              {nav.wallet}
            </Link>
          </DropdownMenuItem>
        )}

        {/*
          Every role can buy a course and every role's purchase shows up here
          - an instructor or an admin who bought someone else's course is not
          a hypothetical, the wallet and purchase flow never distinguished
          roles either. This sits alongside the role's own dashboard link
          below, not instead of it.
        */}
        <DropdownMenuItem asChild>
          <Link href="/my-courses">
            <LayoutDashboard aria-hidden className="size-4" />
            {nav.myCourses}
          </Link>
        </DropdownMenuItem>

        {user.role === "INSTRUCTOR" && (
          <DropdownMenuItem asChild>
            <Link href="/instructor">
              <LayoutDashboard aria-hidden className="size-4" />
              {messages.instructorDashboard}
            </Link>
          </DropdownMenuItem>
        )}

        {user.role === "ADMIN" && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <LayoutDashboard aria-hidden className="size-4" />
              {messages.adminDashboard}
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem tone="destructive" disabled={signingOut} onSelect={() => void signOut()}>
          <LogOut aria-hidden className="size-4" />
          {nav.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
