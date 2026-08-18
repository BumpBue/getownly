import Link from "next/link";
import { BottomNav } from "@/components/shared/BottomNav";
import { MainNav } from "@/components/shared/MainNav";
import { authMessages } from "@/lib/messages/auth";
import { landingMessages } from "@/lib/messages/landing";

/**
 * Header and footer shared by every page a visitor can reach without signing
 * in. The header no longer assumes "visitor" the way it used to: MainNav
 * checks for a session itself, so someone signed in who wanders onto the
 * catalog sees their own avatar here instead of "เข้าสู่ระบบ".
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { brand } = authMessages;
  const { footer } = landingMessages;

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

      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-6 lg:px-8">
          <div>
            <span className="text-lg font-semibold text-primary">{brand.name}</span>
            <p className="mt-2 text-sm text-muted">{brand.tagline}</p>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">{footer.linksHeading}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>
                <Link href="/courses" className="hover:text-primary">
                  {footer.linkCourses}
                </Link>
              </li>
              <li>
                <Link href="/register" className="hover:text-primary">
                  {footer.linkRegister}
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-primary">
                  {footer.linkLogin}
                </Link>
              </li>
              <li>
                <Link href="/register?role=instructor" className="hover:text-primary">
                  {footer.linkInstructor}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground">{footer.contactHeading}</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>{footer.contactEmail}</li>
              <li>{footer.contactPhone}</li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border px-4 py-4 text-center text-xs text-subtle sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {brand.name}
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}
