"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, Clock, GraduationCap, ImageOff, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ApiError } from "@/lib/api-client";
import { formatBaht, formatCount, formatDate, formatDuration, isFree } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { courseMessages } from "@/lib/messages/courses";
import { walletMessages } from "@/lib/messages/wallet";
import { listMyEnrollments } from "@/lib/wallet/api";
import type { MyEnrollment } from "@/lib/wallet/types";

/** Everything this student has bought, with how far through each one they are. */
export function MyCoursesView() {
  const { myCourses } = walletMessages;

  const [items, setItems] = useState<MyEnrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setItems(await listMyEnrollments());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <SectionHeading
        as="h1"
        title={myCourses.title}
        subtitle={myCourses.subtitle}
        action={
          <Button asChild variant="outline">
            <Link href="/courses">{myCourses.browse}</Link>
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <span className="sr-only">{myCourses.loading}</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-72 rounded-card" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={myCourses.errorTitle}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {courseMessages.catalog.retry}
            </Button>
          }
        />
      ) : items && items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <EnrollmentCard key={item.id} enrollment={item} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={GraduationCap}
          title={myCourses.emptyTitle}
          body={myCourses.emptyBody}
          action={
            <Button asChild>
              <Link href="/courses">{myCourses.browse}</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}

function EnrollmentCard({ enrollment }: { enrollment: MyEnrollment }) {
  const { myCourses } = walletMessages;

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-border bg-card">
      <Link
        href={`/courses/${enrollment.courseId}`}
        className="relative aspect-video w-full border-b border-border bg-background"
      >
        {enrollment.coverUrl ? (
          <Image
            src={enrollment.coverUrl}
            alt={enrollment.courseTitle}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
            <ImageOff aria-hidden className="size-6" />
            <span className="text-xs">{courseMessages.card.noCover}</span>
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h2 className="line-clamp-2 text-base font-semibold leading-snug text-foreground">
          {enrollment.courseTitle}
        </h2>
        <p className="text-sm text-muted">{enrollment.instructorName}</p>

        <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
          <div className="flex items-center gap-1.5">
            <BookOpen aria-hidden className="size-3.5" />
            <dd className="tabular">
              {formatCount(enrollment.lessonCount)} {courseMessages.card.lessonsSuffix}
            </dd>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock aria-hidden className="size-3.5" />
            <dd className="tabular">{formatDuration(enrollment.totalDurationSec)}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Progress
            value={enrollment.progressPercent}
            label={`${myCourses.progressLabel} · ${enrollment.completedLessonCount}/${enrollment.lessonCount} ${myCourses.lessonsProgressSuffix}`}
          />

          <p className="tabular text-xs text-subtle">
            {myCourses.purchasedPrefix} {formatDate(enrollment.enrolledAt)} ·{" "}
            {isFree(enrollment.pricePaid)
              ? courseMessages.card.free
              : `${myCourses.pricePaidPrefix} ${formatBaht(enrollment.pricePaid)}`}
          </p>

          {/* /learn/<course> is a doorway, not a screen: it works out which
              lesson to resume and redirects there. */}
          <Button asChild block disabled={enrollment.lessonCount === 0}>
            <Link href={`/learn/${enrollment.courseId}`}>{myCourses.continue}</Link>
          </Button>
        </div>
      </div>
    </article>
  );
}
