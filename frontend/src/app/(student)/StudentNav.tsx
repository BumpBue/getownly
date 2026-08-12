"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LogOut, Wallet } from "lucide-react";
import { logout } from "@/lib/auth/api";
import { formatBaht } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { walletMessages } from "@/lib/messages/wallet";
import { getWallet } from "@/lib/wallet/api";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/courses", label: walletMessages.nav.catalog },
  { href: "/my-courses", label: walletMessages.nav.myCourses },
  { href: "/wallet", label: walletMessages.nav.wallet },
  { href: "/profile", label: adminMessages.profile.title },
];

/**
 * Header for the signed-in student area.
 *
 * The balance is fetched here rather than passed down, so it is one request per
 * page load instead of one per screen that wants to show it. A failed fetch
 * simply hides the chip: an unreachable API must not take the navigation with it.
 */
export function StudentNav() {
  const { nav } = walletMessages;
  const router = useRouter();
  const pathname = usePathname();

  const [balance, setBalance] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getWallet(1, 1)
      .then((wallet) => {
        if (!cancelled) {
          setBalance(wallet.balance);
        }
      })
      .catch(() => {
        // Nothing to say here; the chip stays hidden.
      });

    return () => {
      cancelled = true;
    };
    // Re-read after a purchase or a top-up approval changes the number.
  }, [pathname]);

  const signOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      // Whatever the API said, the session is over as far as this tab knows.
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="text-xl font-semibold text-primary">
          {nav.brand}
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? "page" : undefined}
              className={cn(
                "rounded-control px-3 py-2 font-medium transition-colors duration-150 hover:bg-background",
                isActive(pathname, link.href) ? "text-primary" : "text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {balance !== null && (
            <Link
              href="/wallet"
              title={nav.balanceLabel}
              className="flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-background"
            >
              <Wallet aria-hidden className="size-4 text-secondary" />
              <span className="sr-only">{nav.balanceLabel}</span>
              <span className="tabular font-semibold text-secondary">{formatBaht(balance)}</span>
            </Link>
          )}

          <button
            type="button"
            onClick={() => void signOut()}
            disabled={signingOut}
            className="flex items-center gap-1.5 rounded-control px-3 py-2 text-sm text-muted transition-colors duration-150 hover:bg-background hover:text-foreground disabled:opacity-50"
          >
            <LogOut aria-hidden className="size-4" />
            <span className="hidden sm:inline">{nav.logout}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
