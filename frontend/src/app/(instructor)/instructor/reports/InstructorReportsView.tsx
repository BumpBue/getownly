"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Coins,
  MessageCircleQuestion,
  ServerCrash,
  ShoppingCart,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseStatusBadge } from "@/components/shared/CourseStatusBadge";
import { EarningsTable } from "./EarningsTable";
import { EmptyState } from "@/components/shared/EmptyState";
import { MonthlyEarningsChart } from "@/components/shared/MonthlyEarningsChart";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { StatTile } from "@/components/shared/StatTile";
import { ApiError } from "@/lib/api-client";
import { getInstructorOverview } from "@/lib/admin/api";
import type { InstructorOverview } from "@/lib/admin/types";
import { formatBaht, formatCount } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";

/** The instructor's own numbers: six months of earnings, then course by course. */
export function InstructorReportsView() {
  const { instructorReports: messages } = adminMessages;

  const [data, setData] = useState<InstructorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await getInstructorOverview());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (error && data === null) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={messages.errorTitle}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {adminMessages.reports.retry}
            </Button>
          }
        />
      </div>
    );
  }

  const hasEarnings = data?.monthly.some((point) => Number(point.earnings) > 0) ?? false;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <SectionHeading as="h1" title={messages.title} subtitle={messages.subtitle} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={Coins}
          label={messages.totalEarnings}
          value={Number(data?.totalEarnings ?? 0)}
          format={(n) => formatBaht(n.toFixed(2))}
          loading={loading}
        />
        <StatTile
          icon={Coins}
          label={messages.last30Days}
          value={Number(data?.last30DaysEarnings ?? 0)}
          format={(n) => formatBaht(n.toFixed(2))}
          loading={loading}
        />
        <StatTile
          icon={ShoppingCart}
          label={messages.totalSales}
          value={data?.totalSalesCount ?? 0}
          suffix={messages.salesSuffix}
          loading={loading}
        />
        <StatTile
          icon={Wallet}
          label={messages.walletBalance}
          value={Number(data?.walletBalance ?? 0)}
          format={(n) => formatBaht(n.toFixed(2))}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={Users}
          label={messages.studentCount}
          value={data?.studentCount ?? 0}
          suffix={messages.peopleSuffix}
          loading={loading}
        />
        <StatTile
          icon={BookOpen}
          label={messages.publishedCourses}
          value={data?.publishedCourses ?? 0}
          suffix={messages.coursesSuffix}
          loading={loading}
        />
        <StatTile
          icon={MessageCircleQuestion}
          label={messages.pendingQuestions}
          value={data?.pendingQuestions ?? 0}
          suffix={messages.questionsSuffix}
          loading={loading}
        />
      </div>

      <section className="rounded-card border border-border bg-card">
        <h2 className="border-b border-border px-5 py-4 text-base font-semibold text-foreground">
          {messages.chartTitle}
        </h2>

        <div className="px-2 py-4 sm:px-4">
          {loading ? (
            <Skeleton className="h-72 rounded-control" />
          ) : hasEarnings && data ? (
            <MonthlyEarningsChart points={data.monthly} />
          ) : (
            <EmptyState icon={BarChart3} title={messages.chartEmpty} />
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-card border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{messages.coursesTitle}</h2>
          <p className="mt-0.5 text-xs text-subtle">{messages.grossNote}</p>
        </div>

        {loading ? (
          <Skeleton className="m-5 h-40 rounded-control" />
        ) : data && data.courses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">{messages.columnCourse}</th>
                  <th className="px-5 py-2.5 font-medium">{messages.columnStatus}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnSales}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnGross}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnEarnings}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {data.courses.map((course) => (
                  <tr key={course.courseId} className="transition-colors duration-150 hover:bg-background">
                    <td className="px-5 py-3">
                      <Link
                        href={`/instructor/courses/${course.courseId}`}
                        className="line-clamp-1 font-medium text-foreground transition-colors duration-150 hover:text-primary"
                      >
                        {course.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <CourseStatusBadge status={course.status} />
                    </td>
                    <td className="tabular px-5 py-3 text-right text-muted">
                      {formatCount(course.salesCount)}
                    </td>
                    <td className="tabular px-5 py-3 text-right text-muted">
                      {formatBaht(course.grossSales)}
                    </td>
                    <td className="tabular px-5 py-3 text-right font-medium text-foreground">
                      {formatBaht(course.earnings)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title={messages.coursesEmpty}
            body={messages.coursesEmptyBody}
            action={
              <Button asChild>
                <Link href="/instructor/courses/new">{messages.createCourse}</Link>
              </Button>
            }
          />
        )}
      </section>

      {/* ทก.01 A10 — the split, sale by sale. It loads on its own because it
          paginates and filters; the cards above are a single snapshot. */}
      <EarningsTable courses={data?.courses ?? []} />
    </div>
  );
}
