"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, ServerCrash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { PayoutStatusBadge } from "@/components/shared/PayoutStatusBadge";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { formatBaht, formatDateTime } from "@/lib/format";
import { courseMessages } from "@/lib/messages/courses";
import { payoutMessages } from "@/lib/messages/payouts";
import { listPayoutsForAdmin } from "@/lib/payouts/api";
import { cn } from "@/lib/utils";
import {
  PAYOUT_STATUSES,
  type AdminPayoutListItem,
  type PaginatedAdminPayouts,
  type PayoutStatus,
} from "@/lib/payouts/types";
import { ReviewPayoutDialog } from "./ReviewPayoutDialog";

const PAGE_SIZE = 10;

/** Tabs are plain buttons: a native control, keyboard-correct for free. */
const FILTERS: { value: PayoutStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: payoutMessages.admin.filterAll },
  ...PAYOUT_STATUSES.map((status) => ({ value: status, label: payoutMessages.status[status] })),
];

export function PayoutQueue() {
  const labels = payoutMessages.admin;
  const toast = useToast();

  const [filter, setFilter] = useState<PayoutStatus | "ALL">("PENDING");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedAdminPayouts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Only the id is held, not the row.
   *
   * The dialog fetches the request itself, because it needs the account number
   * and the listing deliberately does not carry one.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(
    async (status: PayoutStatus | "ALL", nextPage: number) => {
      setLoading(true);
      setError(null);

      try {
        setData(
          await listPayoutsForAdmin({
            status: status === "ALL" ? undefined : status,
            page: nextPage,
            limit: PAGE_SIZE,
          }),
        );
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : labels.loadFailed);
      } finally {
        setLoading(false);
      }
    },
    [labels.loadFailed],
  );

  useEffect(() => {
    void load(filter, page);
  }, [load, filter, page]);

  /** After a decision the row has moved status, so the page is re-read. */
  const afterReview = useCallback(
    (message: string) => {
      setSelectedId(null);
      toast.success(message);
      void load(filter, page);
    },
    [filter, load, page, toast],
  );

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading
        title={labels.title}
        subtitle={labels.subtitle}
        action={
          data && (
            <div className="flex flex-wrap items-center gap-2">
              {data.pendingTotal > 0 && (
                <Badge tone="pending">
                  {labels.pendingBadgePrefix} {data.pendingTotal} {labels.pendingBadgeSuffix}
                </Badge>
              )}
              <Badge tone="neutral">
                {labels.heldTotalPrefix} {formatBaht(data.pendingAmountTotal)}{" "}
                {labels.heldTotalSuffix}
              </Badge>
            </div>
          )
        }
      />

      <p className="text-xs text-subtle">{labels.heldExplain}</p>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-current={filter === option.value ? "true" : undefined}
            onClick={() => {
              setFilter(option.value);
              setPage(1);
            }}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              filter === option.value
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={labels.loadFailed}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load(filter, page)}>
              {courseMessages.catalog.retry}
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{labels.title}</CardTitle>
          </CardHeader>

          {loading && data === null ? (
            <CardBody className="flex flex-col gap-2">
              <span className="sr-only">{labels.loading}</span>
              {Array.from({ length: 5 }, (_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </CardBody>
          ) : data && data.items.length > 0 ? (
            <>
              <QueueRows items={data.items} onSelect={setSelectedId} />
              <Pager
                page={data.page}
                totalPages={data.totalPages}
                disabled={loading}
                onChange={setPage}
              />
            </>
          ) : (
            <CardBody>
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Inbox aria-hidden className="size-8 text-subtle" />
                <p className="text-base font-medium text-foreground">{labels.empty}</p>
              </div>
            </CardBody>
          )}
        </Card>
      )}

      {selectedId && (
        <ReviewPayoutDialog
          key={selectedId}
          payoutRequestId={selectedId}
          onClose={() => setSelectedId(null)}
          onReviewed={afterReview}
        />
      )}
    </div>
  );
}

/**
 * The queue, as cards on a narrow screen and a table on a wide one.
 *
 * Cards from the start rather than a table with a horizontal scrollbar: five
 * columns do not fit at 375px, and the one that gets pushed off the edge is
 * always the action button (CLAUDE.md, D8).
 */
function QueueRows({
  items,
  onSelect,
}: {
  items: AdminPayoutListItem[];
  onSelect: (id: string) => void;
}) {
  const labels = payoutMessages.admin;

  return (
    <>
      <ul className="flex flex-col divide-y divide-border md:hidden">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {item.instructor.displayName}
                </p>
                <p className="text-xs text-muted">{formatDateTime(item.createdAt)}</p>
              </div>
              <PayoutStatusBadge status={item.status} />
            </div>

            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted">{labels.columnAmount}</dt>
                <dd className="text-base font-semibold tabular-nums text-foreground">
                  {formatBaht(item.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">{labels.columnBalance}</dt>
                <dd className="tabular-nums text-muted">
                  {formatBaht(item.instructor.walletBalance)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted">{labels.columnAccount}</dt>
                <dd className="tabular-nums text-muted">
                  {item.bankName} · {item.accountNumberMasked}
                </dd>
              </div>
            </dl>

            <Button
              variant={item.status === "PENDING" ? "primary" : "outline"}
              size="sm"
              block
              onClick={() => onSelect(item.id)}
            >
              {item.status === "PENDING" ? labels.review : labels.view}
            </Button>
          </li>
        ))}
      </ul>

      <div className="hidden md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">{labels.columnInstructor}</th>
              <th className="px-5 py-2.5 font-medium">{labels.columnAmount}</th>
              <th className="px-5 py-2.5 font-medium">{labels.columnBalance}</th>
              <th className="px-5 py-2.5 font-medium">{labels.columnAccount}</th>
              <th className="px-5 py-2.5 font-medium">{labels.columnRequestedAt}</th>
              <th className="px-5 py-2.5 font-medium">{labels.columnStatus}</th>
              <th className="px-5 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3 text-foreground">{item.instructor.displayName}</td>
                <td className="px-5 py-3 font-medium tabular-nums text-foreground">
                  {formatBaht(item.amount)}
                </td>
                <td className="px-5 py-3 tabular-nums text-muted">
                  {formatBaht(item.instructor.walletBalance)}
                </td>
                <td className="px-5 py-3 tabular-nums text-muted">
                  {item.bankName} · {item.accountNumberMasked}
                </td>
                <td className="px-5 py-3 text-muted">{formatDateTime(item.createdAt)}</td>
                <td className="px-5 py-3">
                  <PayoutStatusBadge status={item.status} />
                </td>
                <td className="px-5 py-3 text-right">
                  <Button
                    variant={item.status === "PENDING" ? "primary" : "outline"}
                    size="sm"
                    onClick={() => onSelect(item.id)}
                  >
                    {item.status === "PENDING" ? labels.review : labels.view}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
