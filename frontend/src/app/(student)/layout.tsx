import { BottomNav } from "@/components/shared/BottomNav";
import { Footer } from "@/components/shared/Footer";
import { MainNav } from "@/components/shared/MainNav";

/**
 * Shell for the pages a signed-in learner uses.
 *
 * Access is enforced twice over: middleware.ts keeps signed-out visitors off
 * these URLs, and every API call behind them is checked again by NestJS. This
 * layout is presentation only. MainNav is shared with (public) - the same
 * header now spans both, so it has to work out its own auth state either way.
 */
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    // pb-16 is on the wrapper, not <main>, so the footer clears BottomNav too
    // (fixed, floating over the reserved gap) - same arrangement as (public).
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <MainNav />
      {/* MainNav is `fixed`; see the same comment in (public)/layout.tsx. */}
      <main className="flex-1 bg-background pt-16">{children}</main>
      <Footer variant="compact" />
      <BottomNav />
    </div>
  );
}
