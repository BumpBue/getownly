"use client";

import { useCallback, useEffect, useState } from "react";
import { Receipt, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { getInstructorEarningTransactions } from "@/lib/admin/api";
import type {
  EarningTransaction,
  InstructorCourseSales,
  PaginatedEarningTransactions,
} from "@/lib/admin/types";
import { formatBaht, formatCount, formatDate, formatRatePercent } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";

/**
 * ทก.01 A10: every sale, and how it was split.
 *
 * The API sends back four recorded figures per row and never a rate applied
 * after the fact, so this component only formats — it does no arithmetic on
 * money at all, not even to check that the columns add up. If they ever
 * stopped adding up, the fix would belong in the ledger, not here.
 */

interface Filters {
  courseId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { courseId: "", from: "", to: "" };

export function EarningsTable({ courses }: { courses: InstructorCourseSales[] }) {
  const messages = adminMessages.instructorReports.earnings;

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedEarningTransactions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(
        await getInstructorEarningTransactions({
          courseId: filters.courseId || undefined,
          from: filters.from || undefined,
          to: filters.to || undefined,
          page,
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Changing what is being asked for always returns to the first page. */
  function updateFilter(patch: Partial<Filters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  }

  const hasFilters = filters.courseId !== "" || filters.from !== "" || filters.to !== "";
  const items = data?.items ?? [];

  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{messages.title}</h2>
        <p className="mt-0.5 text-xs text-subtle">{messages.subtitle}</p>
      </div>

      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-1 flex-col gap-1.5 sm:min-w-[12rem]">
          <span className="text-xs font-medium text-muted">
            {adminMessages.instructorReports.columnCourse}
          </span>
          <Select
            value={filters.courseId}
            onChange={(event) => updateFilter({ courseId: event.target.value })}
          >
            <option value="">{messages.filterCourse}</option>
            {courses.map((course) => (
              <option key={course.courseId} value={course.courseId}>
                {course.title}
              </option>
            ))}
          </Select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">{messages.filterFrom}</span>
          <Input
            type="date"
            value={filters.from}
            max={filters.to || undefined}
            onChange={(event) => updateFilter({ from: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted">{messages.filterTo}</span>
          <Input
            type="date"
            value={filters.to}
            min={filters.from || undefined}
            onChange={(event) => updateFilter({ to: event.target.value })}
          />
        </label>

        {hasFilters && (
          <Button
            variant="outline"
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              setPage(1);
            }}
          >
            {messages.filterReset}
          </Button>
        )}
      </div>

      {error !== null ? (
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
      ) : loading ? (
        <Skeleton className="m-5 h-48 rounded-control" />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={hasFilters ? messages.emptyFiltered : messages.empty}
          body={hasFilters ? messages.emptyFilteredBody : messages.emptyBody}
        />
      ) : (
        <>
          {/* Phones get one card per sale: six columns of figures cannot be
              made legible at 375px, and a sideways-scrolling table hides the
              net amount, which is the column an instructor actually opened
              this screen for. */}
          <ul className="divide-y divide-border md:hidden">
            {items.map((item) => (
              <li key={item.ledgerTransactionId} className="flex flex-col gap-2 px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.courseTitle}</p>
                  <p className="text-xs text-subtle">{formatDate(item.soldAt)}</p>
                </div>

                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
                  <CardRow label={messages.columnGross} value={formatBaht(item.grossAmount)} />
                  <CardRow
                    label={messages.columnRate}
                    value={formatRatePercent(item.commissionRateSnapshot)}
                  />
                  <CardRow
                    label={messages.columnFee}
                    value={`− ${formatBaht(item.platformFeeAmount)}`}
                  />
                  <CardRow label={messages.columnNet} value={formatBaht(item.netAmount)} emphasis />
                </dl>
              </li>
            ))}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-5 py-2.5 font-medium">{messages.columnCourse}</th>
                  <th className="px-5 py-2.5 font-medium">{messages.columnDate}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnGross}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnRate}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnFee}</th>
                  <th className="px-5 py-2.5 text-right font-medium">{messages.columnNet}</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <Row key={item.ledgerTransactionId} item={item} />
                ))}
              </tbody>

              {data !== null && (
                <tfoot className="border-t border-border bg-background text-sm">
                  <tr>
                    <td className="px-5 py-3 text-xs text-muted" colSpan={2}>
                      {messages.totalsLabel}
                    </td>
                    <td className="tabular px-5 py-3 text-right text-muted">
                      {formatBaht(data.totals.grossAmount)}
                    </td>
                    <td />
                    <td className="tabular px-5 py-3 text-right text-muted">
                      − {formatBaht(data.totals.platformFeeAmount)}
                    </td>
                    <td className="tabular px-5 py-3 text-right font-semibold text-foreground">
                      {formatBaht(data.totals.netAmount)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {data !== null && (
            <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted">
                {messages.countStatus.replace("{total}", formatCount(data.total))}
                {" · "}
                {messages.pageStatus
                  .replace("{page}", formatCount(data.page))
                  .replace("{totalPages}", formatCount(data.totalPages))}
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  {messages.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  {messages.next}
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function Row({ item }: { item: EarningTransaction }) {
  return (
    <tr className="transition-colors duration-150 hover:bg-background">
      <td className="px-5 py-3">
        <span className="line-clamp-1 font-medium text-foreground">{item.courseTitle}</span>
      </td>
      <td className="px-5 py-3 text-muted">{formatDate(item.soldAt)}</td>
      <td className="tabular px-5 py-3 text-right text-muted">{formatBaht(item.grossAmount)}</td>
      <td className="tabular px-5 py-3 text-right text-muted">
        {formatRatePercent(item.commissionRateSnapshot)}
      </td>
      <td className="tabular px-5 py-3 text-right text-muted">
        − {formatBaht(item.platformFeeAmount)}
      </td>
      <td className="tabular px-5 py-3 text-right font-medium text-foreground">
        {formatBaht(item.netAmount)}
      </td>
    </tr>
  );
}

function CardRow({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd
        className={
          emphasis ? "tabular font-semibold text-foreground" : "tabular text-sm text-muted"
        }
      >
        {value}
      </dd>
    </div>
  );
}
