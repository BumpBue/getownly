"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Coins,
  Scale,
  ServerCrash,
  ShoppingCart,
  UserPlus,
  Wallet,
} from "lucide-react";
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
  getTrialBalance,
} from "@/lib/admin/api";
import {
  REPORT_RANGES,
  type AdminOverview,
  type DailySales,
  type ReportRangeDays,
  type TopCourse,
  type TopInstructor,
  type TrialBalance,
} from "@/lib/admin/types";
import { formatBaht, formatCount, formatDate, formatDateTime } from "@/lib/format";
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

  // All-time, so it does not depend on `days` and gets its own request and
  // its own loading/error state rather than joining the Promise.all above.
  const [trial, setTrial] = useState<TrialBalance | null>(null);
  const [trialLoading, setTrialLoading] = useState(true);
  const [trialError, setTrialError] = useState<string | null>(null);

  const loadTrial = useCallback(async () => {
    setTrialLoading(true);
    setTrialError(null);

    try {
      setTrial(await getTrialBalance());
    } catch (caught) {
      setTrialError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setTrialLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTrial();
  }, [loadTrial]);

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

      <TrialBalanceSection
        trial={trial}
        loading={trialLoading}
        error={trialError}
        onRetry={() => void loadTrial()}
      />
    </div>
  );
}

/**
 * งบทดลอง — its own section, own request and own error state on purpose: an
 * all-time proof that the ledger balances has nothing to do with the date
 * range picker above it, and a failure in one must not hide the other.
 */
function TrialBalanceSection({
  trial,
  loading,
  error,
  onRetry,
}: {
  trial: TrialBalance | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { reports: messages } = adminMessages;

  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {messages.trialBalanceTitle}
          </h2>
          <p className="mt-0.5 text-xs text-muted">{messages.trialBalanceSubtitle}</p>
        </div>

        {trial && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1 text-xs font-medium",
              trial.isBalanced
                ? "border-success/30 bg-success/5 text-success"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            {trial.isBalanced ? (
              <CheckCircle2 aria-hidden className="size-3.5" />
            ) : (
              <AlertTriangle aria-hidden className="size-3.5" />
            )}
            {trial.isBalanced ? messages.balancedNotice : messages.unbalancedNotice}
          </span>
        )}
      </div>

      {error && trial === null ? (
        <div className="p-5">
          <EmptyState
            icon={ServerCrash}
            tone="destructive"
            title={messages.errorTitle}
            body={error}
            action={
              <Button variant="outline" onClick={onRetry}>
                {messages.retry}
              </Button>
            }
          />
        </div>
      ) : loading ? (
        <div className="p-5">
          <Skeleton className="h-40 rounded-control" />
        </div>
      ) : trial && trial.rows.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-160 text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">{messages.columnAccountKind}</th>
                  <th className="px-5 py-2.5 text-right font-medium">
                    {messages.columnAccountCount}
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnDebit}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnCredit}</th>
                  <th className="px-5 py-2.5 text-right font-medium">
                    {messages.columnNetBalance}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {trial.rows.map((row) => (
                  <tr key={row.kind}>
                    <td className="px-5 py-3 font-medium text-foreground">
                      {messages.accountKindLabels[row.kind] ?? row.kind}
                    </td>
                    <td className="tabular px-5 py-3 text-right text-muted">
                      {formatCount(row.accountCount)}
                    </td>
                    <td className="tabular px-5 py-3 text-right text-foreground">
                      {formatBaht(row.totalDebit)}
                    </td>
                    <td className="tabular px-5 py-3 text-right text-foreground">
                      {formatBaht(row.totalCredit)}
                    </td>
                    <td className="tabular px-5 py-3 text-right font-medium text-secondary">
                      {formatBaht(row.netBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border font-semibold">
                  <td className="px-5 py-3 text-foreground">{messages.totalRow}</td>
                  <td />
                  <td className="tabular px-5 py-3 text-right text-foreground">
                    {formatBaht(trial.totalDebit)}
                  </td>
                  <td className="tabular px-5 py-3 text-right text-foreground">
                    {formatBaht(trial.totalCredit)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="tabular border-t border-border px-5 py-3 text-xs text-subtle">
            {messages.asOfPrefix} {formatDateTime(trial.asOf)}
          </p>
        </>
      ) : (
        <div className="p-5">
          <EmptyState icon={Scale} title={messages.trialBalanceEmpty} />
        </div>
      )}
    </section>
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
