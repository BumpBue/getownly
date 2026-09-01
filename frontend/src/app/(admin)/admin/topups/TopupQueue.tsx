"use client";

import { useCallback, useEffect, useState } from "react";
import { Inbox, ServerCrash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { TopupStatusBadge } from "@/components/shared/TopupStatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { formatBaht, formatDateTime } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { courseMessages } from "@/lib/messages/courses";
import { walletMessages } from "@/lib/messages/wallet";
import { listTopupsForAdmin } from "@/lib/wallet/api";
import { cn } from "@/lib/utils";
import {
  TOPUP_STATUSES,
  type AdminTopupRequest,
  type PaginatedAdminTopups,
  type TopupStatus,
} from "@/lib/wallet/types";
import { ReviewDialog } from "./ReviewDialog";

const PAGE_SIZE = 10;

/** Tabs are plain buttons: a native control, keyboard-correct for free. */
const FILTERS: { value: TopupStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: walletMessages.admin.topups.filterAll },
  ...TOPUP_STATUSES.map((status) => ({ value: status, label: walletMessages.status[status] })),
];

export function TopupQueue() {
  const labels = walletMessages.admin.topups;
  const toast = useToast();

  const [filter, setFilter] = useState<TopupStatus | "ALL">("PENDING");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<PaginatedAdminTopups | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<AdminTopupRequest | null>(null);

  const load = useCallback(async (status: TopupStatus | "ALL", nextPage: number) => {
    setLoading(true);
    setError(null);

    try {
      setData(
        await listTopupsForAdmin({
          status: status === "ALL" ? undefined : status,
          page: nextPage,
          limit: PAGE_SIZE,
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(filter, page);
  }, [load, filter, page]);

  /** After a decision the row has moved status, so the page is re-read. */
  const afterReview = useCallback(
    (message: string) => {
      setSelected(null);
      toast.success(message);
      void load(filter, page);
    },
    [load, filter, page, toast],
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <SectionHeading
        as="h1"
        title={labels.title}
        subtitle={labels.subtitle}
        action={
          data &&
          data.pendingTotal > 0 && (
            <Badge tone="pending">
              {labels.pendingBadgePrefix} {data.pendingTotal} {labels.pendingBadgeSuffix}
            </Badge>
          )
        }
      />

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
          title={labels.errorTitle}
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
              <QueueTable items={data.items} onSelect={setSelected} />
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
                <div>
                  <p className="text-base font-medium text-foreground">{labels.emptyTitle}</p>
                  <p className="mt-1.5 text-sm text-muted">{labels.emptyBody}</p>
                </div>
              </div>
            </CardBody>
          )}
        </Card>
      )}

      {selected && (
        <ReviewDialog
          key={selected.id}
          request={selected}
          onClose={() => setSelected(null)}
          onReviewed={afterReview}
        />
      )}
    </div>
  );
}

function QueueTable({
  items,
  onSelect,
}: {
  items: AdminTopupRequest[];
  onSelect: (request: AdminTopupRequest) => void;
}) {
  const { columns, review, view } = walletMessages.admin.topups;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-192 text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.requestedAt}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.student}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              {columns.amount}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.status}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.reviewedBy}
            </th>
            <th scope="col" className="px-5 py-3" />
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id} className="transition-colors duration-150 hover:bg-background">
              <td className="tabular whitespace-nowrap px-5 py-3.5 text-muted">
                {formatDateTime(item.createdAt)}
              </td>
              <td className="px-5 py-3.5">
                <span className="block font-medium text-foreground">
                  {item.student.displayName}
                </span>
                <span className="block text-xs text-subtle">{item.student.email}</span>
              </td>
              <td className="tabular px-5 py-3.5 text-right font-semibold text-secondary">
                {formatBaht(item.amount)}
              </td>
              <td className="px-5 py-3.5">
                <TopupStatusBadge status={item.status} />
              </td>
              <td className="px-5 py-3.5 text-muted">{item.reviewedBy?.displayName ?? "—"}</td>
              <td className="px-5 py-3.5 text-right">
                <Button
                  variant={item.status === "PENDING" ? "primary" : "outline"}
                  size="sm"
                  onClick={() => onSelect(item)}
                >
                  {item.status === "PENDING" ? review : view}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
