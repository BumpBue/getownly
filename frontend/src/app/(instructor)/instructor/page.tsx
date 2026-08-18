"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, GraduationCap, Layers, Plus, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseStatusBadge } from "@/components/shared/CourseStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { getMyStats, listMyCourses } from "@/lib/catalog/api";
import { formatBahtShort, formatCount, formatDate, isFree } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { courseMessages } from "@/lib/messages/courses";
import { instructorMessages } from "@/lib/messages/instructor";
import type { InstructorCourse, InstructorStats } from "@/lib/catalog/types";

/** Overview cards plus the instructor's own course table. */
export default function InstructorDashboardPage() {
  const { dashboard } = instructorMessages;

  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [courses, setCourses] = useState<InstructorCourse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextStats, nextCourses] = await Promise.all([getMyStats(), listMyCourses()]);
      setStats(nextStats);
      setCourses(nextCourses);
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
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionHeading
        as="h1"
        title={dashboard.title}
        subtitle={dashboard.subtitle}
        action={
          <Button asChild>
            <Link href="/instructor/courses/new">
              <Plus aria-hidden />
              {instructorMessages.nav.newCourse}
            </Link>
          </Button>
        }
      />

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={dashboard.errorTitle}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {courseMessages.catalog.retry}
            </Button>
          }
        />
      ) : (
        <>
          {stats && <StatCards stats={stats} />}

          <Card>
            <CardHeader>
              <CardTitle>{dashboard.tableHeading}</CardTitle>
            </CardHeader>

            {courses && courses.length > 0 ? (
              <CourseTable courses={courses} />
            ) : (
              <CardBody>
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                  <BookOpen aria-hidden className="size-8 text-subtle" />
                  <div>
                    <p className="text-base font-medium text-foreground">{dashboard.emptyTitle}</p>
                    <p className="mt-1.5 text-sm text-muted">{dashboard.emptyBody}</p>
                  </div>
                  <Button asChild variant="outline">
                    <Link href="/instructor/courses/new">
                      <Plus aria-hidden />
                      {instructorMessages.nav.newCourse}
                    </Link>
                  </Button>
                </div>
              </CardBody>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatCards({ stats }: { stats: InstructorStats }) {
  const { stats: labels } = instructorMessages.dashboard;

  const tiles = [
    { label: labels.totalCourses, value: stats.totalCourses, icon: BookOpen, tone: "text-primary" },
    { label: labels.published, value: stats.publishedCourses, icon: BookOpen, tone: "text-success" },
    { label: labels.pending, value: stats.pendingCourses, icon: BookOpen, tone: "text-pending" },
    { label: labels.draft, value: stats.draftCourses, icon: BookOpen, tone: "text-subtle" },
    { label: labels.students, value: stats.totalStudents, icon: GraduationCap, tone: "text-primary" },
    { label: labels.lessons, value: stats.totalLessons, icon: Layers, tone: "text-primary" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {tiles.map(({ label, value, icon: Icon, tone }) => (
        <div
          key={label}
          className="flex items-center gap-3 rounded-card border border-border bg-card p-4"
        >
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-control bg-background ${tone}`}
          >
            <Icon aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs text-muted">{label}</p>
            <p className="tabular mt-0.5 text-2xl font-semibold text-foreground">
              {formatCount(value)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CourseTable({ courses }: { courses: InstructorCourse[] }) {
  const { columns, manage } = instructorMessages.dashboard;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[52rem] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.course}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.category}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.status}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              {columns.price}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              {columns.lessons}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              {columns.students}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              {columns.updated}
            </th>
            <th scope="col" className="px-5 py-3" />
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {courses.map((course) => (
            <tr key={course.id} className="transition-colors duration-150 hover:bg-background">
              <td className="max-w-xs px-5 py-3.5">
                <span className="line-clamp-2 font-medium text-foreground">{course.title}</span>
              </td>
              <td className="px-5 py-3.5 text-muted">{course.category.name}</td>
              <td className="px-5 py-3.5">
                <CourseStatusBadge status={course.status} />
              </td>
              <td className="tabular px-5 py-3.5 text-right">
                {isFree(course.price) ? (
                  <span className="font-medium text-success">{courseMessages.card.free}</span>
                ) : (
                  <span className="font-semibold text-secondary">
                    {formatBahtShort(course.price)}
                  </span>
                )}
              </td>
              <td className="tabular px-5 py-3.5 text-right text-muted">
                {formatCount(course.lessonCount)}
              </td>
              <td className="tabular px-5 py-3.5 text-right text-muted">
                {formatCount(course.enrollmentCount)}
              </td>
              <td className="tabular px-5 py-3.5 text-right text-muted">
                {formatDate(course.updatedAt)}
              </td>
              <td className="px-5 py-3.5 text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/instructor/courses/${course.id}`}>{manage}</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <span className="sr-only">{instructorMessages.dashboard.loading}</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-card" />
        ))}
      </div>
      <Skeleton className="h-72 rounded-card" />
    </div>
  );
}
