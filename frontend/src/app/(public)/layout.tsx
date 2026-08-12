import { MainNav } from "@/components/shared/MainNav";
import { authMessages } from "@/lib/messages/auth";

/**
 * Header and footer shared by every page a visitor can reach without signing
 * in. The header no longer assumes "visitor" the way it used to: MainNav
 * checks for a session itself, so someone signed in who wanders onto the
 * catalog sees their own avatar here instead of "เข้าสู่ระบบ".
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { brand } = authMessages;

  return (
    <div className="flex min-h-screen flex-col">
      <MainNav />

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-8 text-sm text-muted sm:px-6 lg:px-8">
          <span className="font-semibold text-primary">{brand.name}</span>
          <span>{brand.tagline}</span>
          <span className="mt-3 text-xs text-subtle">
            © {new Date().getFullYear()} {brand.name}
          </span>
        </div>
      </footer>
    </div>
  );
}
