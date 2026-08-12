import Link from "next/link";
import { authMessages } from "@/lib/messages/auth";
import { courseMessages } from "@/lib/messages/courses";

/** Header and footer shared by every page a visitor can reach without signing in. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const { brand } = authMessages;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-xl font-semibold text-primary">{brand.name}</span>
            <span className="hidden text-xs text-muted sm:inline">{brand.tagline}</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/courses"
              className="rounded-control px-3 py-2 font-medium text-foreground transition-colors duration-150 hover:bg-background"
            >
              {courseMessages.catalog.title}
            </Link>
            <Link
              href="/login"
              className="rounded-control px-3 py-2 font-medium text-foreground transition-colors duration-150 hover:bg-background"
            >
              {authMessages.login.title}
            </Link>
            <Link
              href="/register"
              className="rounded-control bg-primary px-4 py-2 font-medium text-primary-foreground transition-colors duration-150 hover:bg-primary/90"
            >
              {authMessages.register.title}
            </Link>
          </nav>
        </div>
      </header>

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
