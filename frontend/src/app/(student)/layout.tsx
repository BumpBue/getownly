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
    <div className="flex min-h-screen flex-col">
      <MainNav />
      <main className="flex-1 bg-background">{children}</main>
    </div>
  );
}
