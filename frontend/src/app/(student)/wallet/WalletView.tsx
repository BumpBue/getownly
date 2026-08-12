"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Plus, Receipt, ServerCrash, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { ApiError } from "@/lib/api-client";
import { formatBaht, formatDate } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { courseMessages } from "@/lib/messages/courses";
import { walletMessages } from "@/lib/messages/wallet";
import { getWallet } from "@/lib/wallet/api";
import type { WalletEntry, WalletPage } from "@/lib/wallet/types";

const PAGE_SIZE = 20;

/** Balance card plus the statement behind it. */
export function WalletView() {
  const { wallet: labels } = walletMessages;

  const [page, setPage] = useState(1);
  const [data, setData] = useState<WalletPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError(null);

    try {
      setData(await getWallet(nextPage, PAGE_SIZE));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold text-primary">{labels.title}</h1>
        <p className="mt-1 text-sm text-muted">{labels.subtitle}</p>
      </header>

      {/* -------------------------------------------------------------- */}
      {/* Balance                                                         */}
      {/* -------------------------------------------------------------- */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-6 py-6">
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-control border border-border bg-background">
              <Wallet aria-hidden className="size-5 text-secondary" />
            </span>
            <div>
              <p className="text-sm text-muted">{labels.balanceLabel}</p>
              {loading && data === null ? (
                <Skeleton className="mt-2 h-10 w-48" />
              ) : (
                <p className="tabular mt-1 text-4xl font-bold text-secondary">
                  {formatBaht(data?.balance ?? "0.00")}
                </p>
              )}
              <p className="mt-1.5 text-xs text-subtle">{labels.balanceHint}</p>
            </div>
          </div>

          <Button asChild size="lg">
            <Link href="/wallet/topup">
              <Plus aria-hidden />
              {labels.topupButton}
            </Link>
          </Button>
        </CardBody>
      </Card>

      {/* -------------------------------------------------------------- */}
      {/* Statement                                                       */}
      {/* -------------------------------------------------------------- */}
      {error ? (
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={labels.errorTitle}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load(page)}>
              {courseMessages.catalog.retry}
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <CardTitle>{labels.historyHeading}</CardTitle>
            {data && data.total > 0 && (
              <span className="tabular text-xs text-muted">
                {courseMessages.catalog.resultsPrefix} {data.total}
              </span>
            )}
          </CardHeader>

          {loading && data === null ? (
            <CardBody className="flex flex-col gap-3">
              <span className="sr-only">{labels.loading}</span>
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-12" />
              ))}
            </CardBody>
          ) : data && data.entries.length > 0 ? (
            <>
              <EntryTable entries={data.entries} />
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
                <Receipt aria-hidden className="size-8 text-subtle" />
                <div>
                  <p className="text-base font-medium text-foreground">{labels.emptyTitle}</p>
                  <p className="mt-1.5 text-sm text-muted">{labels.emptyBody}</p>
                </div>
              </div>
            </CardBody>
          )}
        </Card>
      )}
    </div>
  );
}

function EntryTable({ entries }: { entries: WalletEntry[] }) {
  const { columns, typeLabels } = walletMessages.wallet;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-160 text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.date}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.description}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {columns.type}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              {columns.amount}
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {entries.map((entry) => {
            const incoming = entry.direction === "CREDIT";

            return (
              <tr key={entry.entryId} className="transition-colors duration-150 hover:bg-background">
                <td className="tabular whitespace-nowrap px-5 py-3.5 text-muted">
                  {formatDate(entry.createdAt)}
                </td>
                <td className="px-5 py-3.5 text-foreground">{entry.description}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={incoming ? "success" : "neutral"}>{typeLabels[entry.type]}</Badge>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <span
                    className={`tabular inline-flex items-center gap-1 font-semibold ${
                      incoming ? "text-success" : "text-foreground"
                    }`}
                  >
                    {incoming ? (
                      <ArrowDownLeft aria-hidden className="size-3.5" />
                    ) : (
                      <ArrowUpRight aria-hidden className="size-3.5" />
                    )}
                    {incoming ? "+" : "-"}
                    {formatBaht(entry.amount)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
