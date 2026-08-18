import { BottomNav } from "@/components/shared/BottomNav";
import { MainNav } from "@/components/shared/MainNav";

/**
 * Shell for the pages that belong to a person rather than to a role.
 *
 * Its own route group because /profile and /home are for all three roles: the
 * student header would offer an admin a wallet and "my courses" that make no
 * sense to hand-pick around, and either sidebar would put them somewhere they
 * are not. MainNav already works out its own session and role, the same as it
 * does for (public) and (student), so it belongs here too rather than a
 * second hand-built header - each page still sets its own content width.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />
      {/* MainNav is `fixed`; see the same comment in (public)/layout.tsx. */}
      {/* pb-16 clears BottomNav on phones, where it is fixed to the bottom. */}
      <main className="flex-1 bg-background pt-16 pb-16 md:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}
