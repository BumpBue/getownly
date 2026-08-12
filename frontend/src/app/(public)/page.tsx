import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authMessages } from "@/lib/messages/auth";
import { courseMessages } from "@/lib/messages/courses";

/**
 * Landing page. The curated sections (featured courses, categories,
 * best sellers) belong to a later phase; for now it points at the catalog,
 * which is the real screen.
 */
export default function HomePage() {
  const { brand } = authMessages;

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-semibold leading-tight text-primary lg:text-5xl">
          {brand.pitchTitle}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-muted">{brand.pitchBody}</p>

        <div className="mt-8">
          <Button asChild size="lg">
            <Link href="/courses">
              {courseMessages.catalog.title}
              <ArrowLeft aria-hidden className="rotate-180" />
            </Link>
          </Button>
        </div>
      </div>

      <ul className="mt-16 grid gap-4 sm:grid-cols-3">
        {brand.points.map((point) => (
          <li key={point} className="rounded-card border border-border bg-card p-5 text-sm text-muted">
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
