"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Menu, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CourseSearchBox } from "./CourseSearchBox";
import { UserMenu } from "./UserMenu";
import { me } from "@/lib/auth/api";
import type { UserProfile } from "@/lib/auth/types";
import { formatBaht } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { navMessages } from "@/lib/messages/nav";
import { walletMessages } from "@/lib/messages/wallet";
import { getWallet } from "@/lib/wallet/api";

/**
 * The one header for every page a guest, a student, an instructor or an
 * admin might all reach the same way: the public catalog, the learning
 * pages, the wallet, "my courses". /admin and /instructor keep their own
 * sidebars - this never renders there.
 *
 * Session state is read here, not passed in: this header sits above both
 * the (public) group (which never had a signed-in concept before) and the
 * (student) group (which assumed one), so it has to work out for itself
 * whether anyone is signed in and as what role.
 */
export function MainNav() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  const [user, setUser] = useState<UserProfile | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const loadUser = useCallback(async () => {
    try {
      // A guest on a public page is a normal outcome here, not a dead
      // session - silentOn401 keeps apiRequest from redirecting them away.
      const { user: loaded } = await me({ silentOn401: true });
      setUser(loaded);
    } catch {
      setUser(null);
    } finally {
      setCheckedAuth(true);
    }
  }, []);

  useEffect(() => {
    void loadUser();
    // Re-checked on every navigation, the same way StudentNav re-read the
    // balance on every navigation: it is how a login or logout elsewhere is
    // noticed without a global session store this app does not otherwise need.
  }, [loadUser, pathname]);

  useEffect(() => {
    if (!user) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    void getWallet(1, 1)
      .then((wallet) => {
        if (!cancelled) {
          setBalance(wallet.balance);
        }
      })
      .catch(() => {
        // An unreachable API must not take the whole header down with it.
      });
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Only the landing page has a hero dark enough to sit a transparent bar on
  // top of - everywhere else this just stays permanently "scrolled".
  useEffect(() => {
    if (!isLandingPage) {
      setScrolled(true);
      return;
    }
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLandingPage]);

  const isGuest = checkedAuth && user === null;
  const transparent = isLandingPage && !scrolled && !mobileOpen;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-colors duration-150 ${
        transparent ? "border-transparent bg-transparent" : "border-b border-border bg-card"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={user ? "/home" : "/"}
          className={`shrink-0 text-xl font-semibold transition-colors duration-150 ${
            transparent ? "text-white" : "text-primary"
          }`}
        >
          {authMessages.brand.name}
        </Link>

        <div className="hidden flex-1 md:flex md:justify-center md:px-4">
          <CourseSearchBox />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Desktop: the full right-hand cluster. */}
          {isGuest && (
            <div className="hidden items-center gap-2 md:flex">
              <Button
                asChild
                variant="ghost"
                className={transparent ? "text-white hover:bg-white/10 hover:text-white" : undefined}
              >
                <Link href="/login">{authMessages.login.title}</Link>
              </Button>
              <Button asChild>
                <Link href="/register">{authMessages.register.title}</Link>
              </Button>
            </div>
          )}

          {user && (
            <div className="hidden items-center gap-2 md:flex">
              <WalletPill balance={balance} />
              <UserMenu user={user} />
            </div>
          )}

          {/* Mobile: only what must always be reachable without opening the panel. */}
          <div className="flex items-center gap-1.5 md:hidden">
            {isGuest && (
              <Button asChild size="sm">
                <Link href="/login">{authMessages.login.title}</Link>
              </Button>
            )}
            {user && <UserMenu user={user} />}

            <button
              type="button"
              aria-label={mobileOpen ? navMessages.mobile.closeMenu : navMessages.mobile.openMenu}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((current) => !current)}
              className={`flex size-10 shrink-0 items-center justify-center rounded-control transition-colors duration-150 ${
                transparent
                  ? "text-white hover:bg-white/10"
                  : "text-muted hover:bg-background hover:text-foreground"
              }`}
            >
              {mobileOpen ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-4 md:hidden">
          <CourseSearchBox className="relative w-full" />

          {user && <WalletPill balance={balance} />}

          {isGuest && (
            <Button asChild variant="outline" block>
              <Link href="/register">{authMessages.register.title}</Link>
            </Button>
          )}
        </div>
      )}
    </header>
  );
}

function WalletPill({ balance }: { balance: string | null }) {
  if (balance === null) {
    return null;
  }

  return (
    <Link
      href="/wallet"
      title={walletMessages.nav.balanceLabel}
      className="flex items-center gap-1.5 rounded-control border border-border px-3 py-1.5 text-sm transition-colors duration-150 hover:bg-background"
    >
      <Wallet aria-hidden className="size-4 text-secondary" />
      <span className="sr-only">{walletMessages.nav.balanceLabel}</span>
      <span className="tabular font-semibold text-secondary">{formatBaht(balance)}</span>
    </Link>
  );
}
