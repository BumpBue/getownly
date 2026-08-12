"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, Coins, ServerCrash, ShoppingCart, UserPlus, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SalesLineChart } from "@/components/shared/SalesLineChart";
import { StatTile } from "@/components/shared/StatTile";
import { ApiError } from "@/lib/api-client";
import {
  getAdminOverview,
  getDailySales,
  getTopCourses,
  getTopInstructors,
} from "@/lib/admin/api";
import {
  REPORT_RANGES,
  type AdminOverview,
  type DailySales,
  type ReportRangeDays,
  type TopCourse,
  type TopInstructor,
} from "@/lib/admin/types";
import { formatBaht, formatCount, formatDate } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";
import { cn } from "@/lib/utils";

const RANGE_LABELS: Record<ReportRangeDays, string> = {
  7: adminMessages.reports.range7,
  30: adminMessages.reports.range30,
  90: adminMessages.reports.range90,
};

/** `days` back from today, as the YYYY-MM-DD the API expects. */
function rangeFor(days: ReportRangeDays): { from: string; to: string } {
  const today = new Date();
  const from = new Date(today.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

interface ReportData {
  overview: AdminOverview;
  daily: DailySales;
  courses: TopCourse[];
  instructors: TopInstructor[];
}

/**
 * The platform report.
 *
 * Four tiles, a line chart and two tables — all four requests fired together
 * because they share one date range and one loading state, and a page that
 * filled in piece by piece would read as broken rather than as fast.
 */
export function ReportsView() {
  const { reports: messages } = adminMessages;

  const [days, setDays] = useState<ReportRangeDays>(30);
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const range = rangeFor(days);

    try {
      const [overview, daily, courses, instructors] = await Promise.all([
        getAdminOverview(range),
        getDailySales(range),
        getTopCourses(range),
        getTopInstructors(range),
      ]);
      setData({ overview, daily, courses, instructors });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasSales = data?.daily.points.some((point) => point.salesCount > 0) ?? false;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{messages.title}</h1>
          <p className="mt-1 text-sm text-muted">{messages.subtitle}</p>
        </div>

        <div role="tablist" aria-label={messages.rangeLabel} className="flex gap-1">
          {REPORT_RANGES.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={days === value}
              onClick={() => setDays(value)}
              className={cn(
                "rounded-control border px-3 py-2 text-sm font-medium transition-colors duration-150",
                days === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted hover:bg-background",
              )}
            >
              {RANGE_LABELS[value]}
            </button>
          ))}
        </div>
      </header>

      {data && (
        <p className="tabular text-xs text-subtle">
          {formatDate(data.overview.range.from)} – {formatDate(data.overview.range.to)} ·{" "}
          {messages.comparedTo} {formatDate(data.overview.range.previousFrom)} –{" "}
          {formatDate(data.overview.range.previousTo)}
        </p>
      )}

      {error && data === null ? (
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={messages.errorTitle}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {messages.retry}
            </Button>
          }
        />
      ) : (
        <>
          {error && <Alert tone="error">{error}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              icon={Wallet}
              label={messages.grossSales}
              value={formatBaht(data?.overview.grossSales.value ?? "0")}
              changePercent={data?.overview.grossSales.changePercent}
              loading={loading}
            />
            <StatTile
              icon={Coins}
              label={messages.platformRevenue}
              value={formatBaht(data?.overview.platformRevenue.value ?? "0")}
              changePercent={data?.overview.platformRevenue.changePercent}
              loading={loading}
            />
            <StatTile
              icon={Coins}
              label={messages.instructorPayable}
              value={formatBaht(data?.overview.instructorPayable.value ?? "0")}
              changePercent={data?.overview.instructorPayable.changePercent}
              loading={loading}
              footnote={messages.payableNote}
            />
            <StatTile
              icon={UserPlus}
              label={messages.newUsers}
              value={formatCount(Number(data?.overview.newUsers.value ?? 0))}
              suffix={messages.peopleSuffix}
              changePercent={data?.overview.newUsers.changePercent}
              loading={loading}
            />
          </div>

          <section className="rounded-card border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-foreground">{messages.chartTitle}</h2>
              {data && (
                <p className="tabular text-xs text-muted">
                  <ShoppingCart aria-hidden className="mr-1 inline size-3.5" />
                  {formatCount(Number(data.overview.salesCount.value))} {messages.timesSuffix}
                </p>
              )}
            </div>

            <div className="px-2 py-4 sm:px-4">
              {loading ? (
                <Skeleton className="h-72 rounded-control" />
              ) : hasSales && data ? (
                <SalesLineChart points={data.daily.points} />
              ) : (
                <EmptyState icon={BarChart3} title={messages.chartEmpty} />
              )}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <TableCard title={messages.topCoursesTitle} loading={loading}>
              {data && data.courses.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">{messages.columnCourse}</th>
                      <th className="px-5 py-2.5 text-right font-medium">{messages.columnSales}</th>
                      <th className="px-5 py-2.5 text-right font-medium">{messages.columnGross}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.courses.map((course) => (
                      <tr key={course.courseId}>
                        <td className="px-5 py-3">
                          <p className="line-clamp-1 font-medium text-foreground">
                            {course.title}
                          </p>
                          <p className="text-xs text-subtle">{course.instructorName}</p>
                        </td>
                        <td className="tabular px-5 py-3 text-right text-muted">
                          {formatCount(course.salesCount)}
                        </td>
                        <td className="tabular px-5 py-3 text-right font-medium text-foreground">
                          {formatBaht(course.grossSales)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon={BarChart3} title={messages.topEmpty} />
              )}
            </TableCard>

            <TableCard title={messages.topInstructorsTitle} loading={loading}>
              {data && data.instructors.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="border-b border-border text-left text-xs text-muted">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">{messages.columnInstructor}</th>
                      <th className="px-5 py-2.5 text-right font-medium">
                        {messages.columnEarnings}
                      </th>
                      <th className="px-5 py-2.5 text-right font-medium">
                        {messages.columnOutstanding}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.instructors.map((instructor) => (
                      <tr key={instructor.instructorId}>
                        <td className="px-5 py-3">
                          <p className="line-clamp-1 font-medium text-foreground">
                            {instructor.displayName}
                          </p>
                          <p className="tabular text-xs text-subtle">
                            {formatCount(instructor.salesCount)} {messages.timesSuffix}
                          </p>
                        </td>
                        <td className="tabular px-5 py-3 text-right font-medium text-foreground">
                          {formatBaht(instructor.earnings)}
                        </td>
                        <td className="tabular px-5 py-3 text-right text-secondary">
                          {formatBaht(instructor.outstandingAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <EmptyState icon={BarChart3} title={messages.topEmpty} />
              )}
            </TableCard>
          </div>
        </>
      )}
    </div>
  );
}

function TableCard({
  title,
  loading,
  children,
}: {
  title: string;
  loading: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <h2 className="border-b border-border px-5 py-4 text-base font-semibold text-foreground">
        {title}
      </h2>
      <div className="overflow-x-auto">
        {loading ? <Skeleton className="m-5 h-40 rounded-control" /> : children}
      </div>
    </section>
  );
}
