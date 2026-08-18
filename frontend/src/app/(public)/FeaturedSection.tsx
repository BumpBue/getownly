import Link from "next/link";
import { BookOpen } from "lucide-react";
import { CourseCard } from "@/components/shared/CourseCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { RevealOnScroll } from "@/components/shared/RevealOnScroll";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Button } from "@/components/ui/button";
import { landingMessages } from "@/lib/messages/landing";
import type { CourseListItem } from "@/lib/catalog/types";

export function FeaturedSection({ courses }: { courses: CourseListItem[] }) {
  const { featured } = landingMessages;

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <RevealOnScroll className="mb-8">
          <SectionHeading
            title={featured.heading}
            subtitle={featured.subheading}
            action={
              courses.length > 0 && (
                <Button asChild variant="outline">
                  <Link href="/courses">{featured.viewAll}</Link>
                </Button>
              )
            }
          />
        </RevealOnScroll>

        {courses.length === 0 ? (
          <RevealOnScroll>
            <EmptyState icon={BookOpen} title={featured.emptyTitle} body={featured.emptyBody} />
          </RevealOnScroll>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {courses.map((course, index) => (
              <RevealOnScroll key={course.id} delayMs={(index % 3) * 80}>
                <CourseCard course={course} />
              </RevealOnScroll>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
