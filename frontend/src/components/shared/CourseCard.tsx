import Image from "next/image";
import Link from "next/link";
import { BookOpen, Clock, ImageOff, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatBahtShort, formatCount, formatDuration, isFree } from "@/lib/format";
import { courseMessages } from "@/lib/messages/courses";
import type { CourseListItem } from "@/lib/catalog/types";

/**
 * One card in the catalog grid.
 *
 * Price is `secondary` and bold; a free course shows the green "ฟรี" pill
 * instead of "฿0", because "free" is the message, not the number.
 */
export function CourseCard({ course }: { course: CourseListItem }) {
  const { card } = courseMessages;
  const free = isFree(course.price);

  return (
    <Link
      href={`/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-card border border-border bg-card transition-colors duration-150 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      <div className="relative aspect-video w-full border-b border-border bg-background">
        {course.coverUrl ? (
          <Image
            src={course.coverUrl}
            alt={course.title}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
            <ImageOff aria-hidden className="size-6" />
            <span className="text-xs">{card.noCover}</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs text-muted">{course.category.name}</span>
          {free && <Badge tone="success">{card.free}</Badge>}
        </div>

        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-foreground group-hover:text-primary">
          {course.title}
        </h3>

        <p className="text-sm text-muted">{course.instructor.displayName}</p>

        <dl className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
          <div className="flex items-center gap-1.5">
            <BookOpen aria-hidden className="size-3.5" />
            <dd className="tabular">
              {formatCount(course.lessonCount)} {card.lessonsSuffix}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock aria-hidden className="size-3.5" />
            <dd className="tabular">{formatDuration(course.totalDurationSec)}</dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Users aria-hidden className="size-3.5" />
            <dd className="tabular">
              {formatCount(course.enrollmentCount)} {card.studentsSuffix}
            </dd>
          </div>
        </dl>

        <div className="border-t border-border pt-3">
          {free ? (
            <span className="tabular text-lg font-bold text-success">{card.free}</span>
          ) : (
            <span className="tabular text-lg font-bold text-secondary">
              {formatBahtShort(course.price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
