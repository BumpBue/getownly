import Link from "next/link";
import { Check } from "lucide-react";
import { authMessages } from "@/lib/messages/auth";

/**
 * Two panes: the brand side on primary, the form side on white.
 * On small screens the brand pane collapses to a slim header.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { brand } = authMessages;

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="flex flex-col justify-between bg-primary px-6 py-8 text-primary-foreground lg:px-12 lg:py-14">
        <Link href="/" className="inline-flex flex-col gap-1">
          <span className="text-2xl font-semibold tracking-wide">{brand.name}</span>
          <span className="text-sm text-secondary">{brand.tagline}</span>
        </Link>

        <div className="hidden max-w-md lg:block">
          <h2 className="text-3xl font-semibold leading-snug">{brand.pitchTitle}</h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/75">
            {brand.pitchBody}
          </p>

          <ul className="mt-8 space-y-3">
            {brand.points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-secondary text-secondary">
                  <Check aria-hidden className="size-3" />
                </span>
                <span className="text-primary-foreground/85">{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="hidden text-xs text-primary-foreground/50 lg:block">
          © {new Date().getFullYear()} {brand.name}
        </p>
      </aside>

      <main className="flex items-center justify-center bg-card px-6 py-12 lg:px-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
