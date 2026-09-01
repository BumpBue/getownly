import Link from "next/link";
import { HeroCourseMockup } from "@/components/shared/HeroCourseMockup";
import { Button } from "@/components/ui/button";
import { formatCount } from "@/lib/format";
import { landingMessages } from "@/lib/messages/landing";
import type { PublicStats } from "@/lib/stats/types";

/**
 * The only section with the dark primary background - MainNav reads the
 * route and starts transparent on top of it, then turns solid past the fold.
 */
export function HeroSection({ stats }: { stats: PublicStats | null }) {
  const { hero } = landingMessages;

  return (
    // -mt-16 cancels the padding-top every other page needs to clear the
    // fixed MainNav (see (public)/layout.tsx) - only here should the hero's
    // own dark background run all the way up under the transparent header.
    <section className="-mt-16 bg-primary">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-28 sm:px-6 lg:px-8 lg:pb-24 lg:pt-32">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <h1 className="text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/80">{hero.subtitle}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link href="/courses">{hero.ctaStudent}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
              >
                <Link href="/register?role=instructor">{hero.ctaInstructor}</Link>
              </Button>
            </div>

            {stats && (
              <dl className="mt-12 flex gap-10">
                <div>
                  <dt className="text-sm text-white/70">{hero.statCourses}</dt>
                  <dd className="tabular mt-1 text-2xl font-semibold text-white">
                    {formatCount(stats.courseCount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-white/70">{hero.statStudents}</dt>
                  <dd className="tabular mt-1 text-2xl font-semibold text-white">
                    {formatCount(stats.studentCount)}
                  </dd>
                </div>
              </dl>
            )}
          </div>

          <div className="hidden justify-center lg:flex">
            <HeroCourseMockup />
          </div>
        </div>
      </div>
    </section>
  );
}
