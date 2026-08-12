import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { walletMessages } from "@/lib/messages/wallet";

/**
 * Shell for the pages that belong to a person rather than to a role.
 *
 * Its own route group because /profile is for all three roles: the student
 * header would offer an admin a wallet and "my courses", and either sidebar
 * would put them somewhere they are not. A plain header sends everyone back to
 * wherever they came from.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="text-xl font-semibold text-primary">
            {walletMessages.nav.brand}
          </Link>

          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {walletMessages.admin.nav.backToSite}
          </Link>
        </div>
      </header>

      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
