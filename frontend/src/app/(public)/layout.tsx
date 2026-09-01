import { BottomNav } from "@/components/shared/BottomNav";
import { Footer } from "@/components/shared/Footer";
import { MainNav } from "@/components/shared/MainNav";

/**
 * Header and footer shared by every page a visitor can reach without signing
 * in. The header no longer assumes "visitor" the way it used to: MainNav
 * checks for a session itself, so someone signed in who wanders onto the
 * catalog sees their own avatar here instead of "เข้าสู่ระบบ".
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    // pb-16 on phones clears BottomNav, which is fixed over the footer. It is
    // on the wrapper rather than <main> so the footer clears it too - the
    // catalog is a (public) route a signed-in student reaches with the bar up.
    <div className="flex min-h-screen flex-col pb-16 md:pb-0">
      <MainNav />

      {/*
        MainNav is `fixed`, not `sticky`, so the landing page's hero can sit
        underneath its transparent phase - which means every other page has
        to make its own room for the header's height. pt-16 does that; the
        hero cancels it back out with a matching negative margin.
      */}
      <main className="flex-1 pt-16">{children}</main>

      <Footer />
      <BottomNav />
    </div>
  );
}
