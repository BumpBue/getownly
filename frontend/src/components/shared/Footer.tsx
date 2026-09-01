import Link from "next/link";
import { authMessages } from "@/lib/messages/auth";
import { landingMessages } from "@/lib/messages/landing";

/**
 * One footer, two sizes.
 *
 * `full` is the marketing footer the landing page's design carries — brand,
 * site links, contact details — appropriate for (public), where a guest may
 * still need "สมัครสมาชิก"/"เข้าสู่ระบบ". `compact` is a single slim line for
 * every screen a signed-in person is already working in (dashboards, the
 * classroom, account settings): just copyright and a couple of short links,
 * because a full marketing footer under a data table is noise, not help.
 */
export function Footer({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { brand } = authMessages;
  const { footer } = landingMessages;
  const year = new Date().getFullYear();

  if (variant === "compact") {
    return (
      <footer className="border-t border-border px-4 py-4 text-xs text-subtle sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
          <p>
            © {year} {brand.name}
          </p>
          <div className="flex items-center gap-4">
            <Link href="/courses" className="transition-colors duration-150 hover:text-primary">
              {footer.linkCourses}
            </Link>
            <a
              href={`mailto:${footer.contactEmail}`}
              className="transition-colors duration-150 hover:text-primary"
            >
              {footer.contactEmail}
            </a>
          </div>
        </div>
      </footer>
    );
  }

  return (
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
        © {year} {brand.name}
      </div>
    </footer>
  );
}
