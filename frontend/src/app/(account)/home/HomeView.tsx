"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Compass,
  GraduationCap,
  ImageOff,
  LayoutDashboard,
  ReceiptText,
  ServerCrash,
  UserRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ApiError } from "@/lib/api-client";
import { getInstructorOverview, listPendingCourses } from "@/lib/admin/api";
import { me } from "@/lib/auth/api";
import type { UserProfile } from "@/lib/auth/types";
import { formatBaht, formatCount, formatDuration } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { courseMessages } from "@/lib/messages/courses";
import { homeMessages } from "@/lib/messages/home";
import { cn } from "@/lib/utils";
import { listMyEnrollments, listTopupsForAdmin } from "@/lib/wallet/api";
import type { MyEnrollment } from "@/lib/wallet/types";

interface InstructorSummary {
  todayEarnings: string;
  todaySalesCount: number;
}

/** Bangkok local time decides the greeting, not UTC. */
function greeting(): string {
  const hour = new Date().getHours();
  const { greeting: g } = homeMessages;
  if (hour < 5) return g.night;
  if (hour < 12) return g.morning;
  if (hour < 17) return g.afternoon;
  if (hour < 20) return g.evening;
  return g.night;
}

/**
 * Where a fresh session lands, for every role - a moment to choose what to
 * do next rather than being dropped straight into a role's own dashboard.
 *
 * A client component for the same reason /my-courses and /learn are: it only
 * ever renders once someone is already signed in, and a Server Component has
 * nowhere to put a refreshed session cookie if the access token has expired
 * since the last page view.
 */
export function HomeView() {
  const { actions, continueLearning, emptyState } = homeMessages;

  const [user, setUser] = useState<UserProfile | null>(null);
  const [enrollments, setEnrollments] = useState<MyEnrollment[] | null>(null);
  const [instructorSummary, setInstructorSummary] = useState<InstructorSummary | null>(null);
  const [adminPendingCount, setAdminPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { user: loaded } = await me();
      setUser(loaded);

      const tasks: Promise<unknown>[] = [listMyEnrollments().then(setEnrollments)];

      if (loaded.role === "INSTRUCTOR") {
        tasks.push(
          getInstructorOverview().then((overview) =>
            setInstructorSummary({
              todayEarnings: overview.todayEarnings,
              todaySalesCount: overview.todaySalesCount,
            }),
          ),
        );
      }

      if (loaded.role === "ADMIN") {
        tasks.push(
          Promise.all([
            listTopupsForAdmin({ status: "PENDING", limit: 1 }),
            listPendingCourses(1),
          ]).then(([topups, courses]) => setAdminPendingCount(topups.pendingTotal + courses.total)),
        );
      }

      await Promise.all(tasks);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Shell>
        <span className="sr-only">{homeMessages.loading}</span>
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-card" />
          ))}
        </div>
      </Shell>
    );
  }

  if (error || !user) {
    return (
      <Shell>
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={homeMessages.errorTitle}
          body={error ?? undefined}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {courseMessages.catalog.retry}
            </Button>
          }
        />
      </Shell>
    );
  }

  const inProgress =
    user.role === "STUDENT"
      ? (enrollments ?? []).find((item) => item.progressPercent > 0 && item.progressPercent < 100)
      : undefined;
  const latestProgress = (enrollments ?? [])[0];

  return (
    <Shell>
      <header>
        <h1 className="text-2xl font-semibold text-primary lg:text-3xl">
          {greeting()}, {user.displayName}
        </h1>
        <p className="mt-1 text-sm text-muted">{homeMessages.subtitle}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ActionCard
          icon={GraduationCap}
          title={actions.myCourses}
          href="/my-courses"
          badge={
            enrollments === null || enrollments.length === 0 ? (
              actions.myCoursesEmpty
            ) : (
              <>
                {formatCount(enrollments.length)} {actions.myCoursesCount}
                {latestProgress && (
                  <span className="text-subtle">
                    {" "}
                    · {actions.myCoursesLatestProgress} {latestProgress.progressPercent}%
                  </span>
                )}
              </>
            )
          }
        />

        <ActionCard
          featured
          icon={Compass}
          title={actions.browseCourses}
          href="/courses"
          badge={actions.browseCoursesHint}
        />

        <ActionCard
          icon={UserRound}
          title={actions.editProfile}
          href="/profile"
          badge={actions.editProfileHint}
        />

        {user.role === "INSTRUCTOR" && (
          <ActionCard
            icon={LayoutDashboard}
            title={actions.instructorDashboard}
            href="/instructor"
            badge={
              instructorSummary && instructorSummary.todaySalesCount > 0 ? (
                <span className="font-medium text-secondary">
                  {actions.instructorTodaySales} {formatBaht(instructorSummary.todayEarnings)} (
                  {formatCount(instructorSummary.todaySalesCount)})
                </span>
              ) : (
                actions.instructorNoSalesToday
              )
            }
          />
        )}

        {user.role === "ADMIN" && (
          <ActionCard
            icon={ReceiptText}
            title={actions.adminDashboard}
            href="/admin"
            badge={
              adminPendingCount !== null && adminPendingCount > 0 ? (
                <Badge tone="pending">
                  {actions.adminPending} {formatCount(adminPendingCount)}
                </Badge>
              ) : (
                actions.adminAllClear
              )
            }
          />
        )}
      </div>

      {user.role === "STUDENT" && (
        <section className="flex flex-col gap-4">
          {inProgress ? (
            <>
              <SectionHeading title={continueLearning.heading} />
              <ResumeCourseCard enrollment={inProgress} />
            </>
          ) : enrollments && enrollments.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title={emptyState.title}
              body={emptyState.body}
              action={
                <Button asChild>
                  <Link href="/courses">
                    {emptyState.cta}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              }
            />
          ) : null}
        </section>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">{children}</div>
  );
}

/**
 * The design's bento tile: icon and status on one row up top, the label
 * anchored at the bottom, all tiles the same height so the row reads as a
 * grid rather than a ragged stack.
 *
 * `featured` is the design's inverted tile - navy fill under a gold top rule.
 * Exactly one tile per row carries it, so it works as the row's way out to
 * the catalog rather than as decoration.
 */
function ActionCard({
  icon: Icon,
  title,
  href,
  badge,
  featured = false,
}: {
  icon: LucideIcon;
  title: string;
  href: string;
  badge: React.ReactNode;
  featured?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-40 flex-col justify-between gap-4 rounded-card border p-5 transition-all duration-150 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        featured
          ? "border-primary border-t-4 border-t-secondary bg-primary"
          : "border-border bg-card hover:border-primary/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
            featured
              ? "bg-white/15 text-primary-foreground"
              : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
          )}
        >
          <Icon aria-hidden className="size-5" />
        </span>
        <span
          className={cn(
            "tabular text-right text-xs",
            featured ? "text-primary-foreground/70" : "text-muted",
          )}
        >
          {badge}
        </span>
      </div>

      <span className={cn("font-semibold", featured ? "text-primary-foreground" : "text-foreground")}>
        {title}
      </span>
    </Link>
  );
}

function ResumeCourseCard({ enrollment }: { enrollment: MyEnrollment }) {
  const { card } = courseMessages;
  const { continueLearning } = homeMessages;

  return (
    <Link
      href={`/learn/${enrollment.courseId}`}
      className="group flex flex-col gap-4 overflow-hidden rounded-card border border-border bg-card transition-all duration-150 hover:-translate-y-1 hover:border-primary/40 sm:flex-row"
    >
      <div className="relative aspect-video w-full shrink-0 border-b border-border bg-background sm:aspect-square sm:w-56 sm:border-b-0 sm:border-r">
        {enrollment.coverUrl ? (
          <Image
            src={enrollment.coverUrl}
            alt={enrollment.courseTitle}
            fill
            sizes="(max-width: 640px) 100vw, 224px"
            className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-subtle">
            <ImageOff aria-hidden className="size-6" />
            <span className="text-xs">{card.noCover}</span>
          </div>
        )}

        {/* The design floats a status pill over the thumbnail. */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-primary">
          <span aria-hidden className="size-1.5 rounded-full bg-secondary" />
          {continueLearning.inProgress}
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 p-5">
        <h3 className="text-lg font-semibold text-foreground group-hover:text-primary">
          {enrollment.courseTitle}
        </h3>
        <p className="text-sm text-muted">{enrollment.instructorName}</p>

        <Progress
          tone="secondary"
          value={enrollment.progressPercent}
          label={`${enrollment.completedLessonCount}/${enrollment.lessonCount} ${card.lessonsSuffix}`}
        />

        <p className="tabular text-xs text-subtle">{formatDuration(enrollment.totalDurationSec)}</p>

        <Button className="w-fit" size="sm">
          {continueLearning.resume}
          <ArrowRight aria-hidden />
        </Button>
      </div>
    </Link>
  );
}
