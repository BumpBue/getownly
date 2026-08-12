"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Check, QrCode, Send, ServerCrash } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Pager } from "@/components/shared/Pager";
import { TopupStatusBadge } from "@/components/shared/TopupStatusBadge";
import { ApiError } from "@/lib/api-client";
import { formatBaht, formatBahtShort, formatDate, formatTime } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { walletMessages } from "@/lib/messages/wallet";
import { cancelTopup, listMyTopups, requestTopupQuote, submitTopup } from "@/lib/wallet/api";
import { QUICK_TOPUP_AMOUNTS, type PaginatedTopups, type TopupQuote } from "@/lib/wallet/types";
import { QrPanel } from "./QrPanel";
import { SlipDropzone } from "./SlipDropzone";

/** Same shape the API accepts, checked here only to save a round trip. */
const AMOUNT_PATTERN = /^\d{1,8}(\.\d{1,2})?$/;

const HISTORY_PAGE_SIZE = 5;

/**
 * The three steps of a manual Thai top-up: pick an amount, scan and pay, then
 * hand the slip over for a human to look at.
 *
 * Nothing here decides that money arrived — the API does not either. The whole
 * flow ends with a PENDING row and a picture (CLAUDE.md, ข้อ 1.3).
 */
export function TopupForm({ initialAmount }: { initialAmount: string | null }) {
  const { topup } = walletMessages;

  const [amount, setAmount] = useState(initialAmount ?? "");
  const [quote, setQuote] = useState<TopupQuote | null>(null);
  const [slipKey, setSlipKey] = useState<string | null>(null);

  const [quoting, setQuoting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const [historyPage, setHistoryPage] = useState(1);
  const [history, setHistory] = useState<PaginatedTopups | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const loadHistory = useCallback(async (page: number) => {
    try {
      setHistory(await listMyTopups(page, HISTORY_PAGE_SIZE));
      setHistoryError(null);
    } catch (caught) {
      setHistoryError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    }
  }, []);

  useEffect(() => {
    void loadHistory(historyPage);
  }, [loadHistory, historyPage]);

  const cancelRequest = useCallback(
    async (id: string) => {
      if (!window.confirm(topup.cancelConfirm)) {
        return;
      }

      setCancellingId(id);
      setHistoryError(null);

      try {
        await cancelTopup(id);
        await loadHistory(historyPage);
      } catch (caught) {
        setHistoryError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
      } finally {
        setCancellingId(null);
      }
    },
    [loadHistory, historyPage, topup.cancelConfirm],
  );

  const createQuote = useCallback(async () => {
    const trimmed = amount.trim();
    if (!AMOUNT_PATTERN.test(trimmed)) {
      setError(topup.invalidAmount);
      return;
    }

    setQuoting(true);
    setError(null);
    setSubmitted(false);

    try {
      setQuote(await requestTopupQuote(trimmed));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setQuoting(false);
    }
  }, [amount, topup.invalidAmount]);

  const submit = useCallback(async () => {
    if (!quote) {
      setError(topup.needQr);
      return;
    }
    if (!slipKey) {
      setError(topup.needSlip);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // The amount from the quote, not from the input: those two can drift
      // apart if the box is edited after the QR was drawn.
      await submitTopup(quote.amount, slipKey);
      setSubmitted(true);
      setQuote(null);
      setSlipKey(null);
      setAmount("");
      setHistoryPage(1);
      await loadHistory(1);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setSubmitting(false);
    }
  }, [quote, slipKey, loadHistory, topup.needQr, topup.needSlip]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-primary"
        >
          <ArrowRight aria-hidden className="size-4 rotate-180" />
          {topup.backToWallet}
        </Link>

        <h1 className="mt-4 text-2xl font-semibold text-primary">{topup.title}</h1>
        <p className="mt-1 text-sm text-muted">{topup.subtitle}</p>
      </div>

      {submitted && (
        <Alert tone="success">
          <Check aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{topup.submitted}</span>
        </Alert>
      )}

      {error && <Alert tone="error">{error}</Alert>}

      {/* ------------------------------------------------------------ */}
      {/* 1. Amount                                                     */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>{topup.stepAmountTitle}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-xs font-medium text-muted">{topup.quickAmountsLabel}</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_TOPUP_AMOUNTS.map((quick) => (
                <Button
                  key={quick}
                  type="button"
                  variant={amount === quick ? "primary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setAmount(quick);
                    setQuote(null);
                    setError(null);
                  }}
                >
                  <span className="tabular">{formatBahtShort(quick)}</span>
                </Button>
              ))}
            </div>
          </div>

          <Field id="topup-amount" label={topup.customAmountLabel}>
            <Input
              id="topup-amount"
              inputMode="decimal"
              placeholder={topup.customAmountPlaceholder}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setQuote(null);
              }}
              className="tabular"
            />
          </Field>

          <Button
            type="button"
            block
            size="lg"
            disabled={quoting || amount.trim().length === 0}
            onClick={() => void createQuote()}
          >
            <QrCode aria-hidden />
            {quote ? topup.changeAmount : topup.createQr}
          </Button>
        </CardBody>
      </Card>

      {/* ------------------------------------------------------------ */}
      {/* 2. QR  ·  3. Slip                                             */}
      {/* ------------------------------------------------------------ */}
      {quote && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{topup.stepQrTitle}</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <QrPanel quote={quote} />
              <p className="text-center text-xs text-subtle">
                {topup.expiresPrefix} {formatTime(quote.expiresAt)}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{topup.stepSlipTitle}</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <SlipDropzone
                slipKey={slipKey}
                onUploaded={setSlipKey}
                onCleared={() => setSlipKey(null)}
                disabled={submitting}
              />

              <Button
                type="button"
                block
                size="lg"
                disabled={submitting || slipKey === null}
                onClick={() => void submit()}
              >
                <Send aria-hidden />
                {submitting ? topup.submitting : topup.submit}
              </Button>
            </CardBody>
          </Card>
        </>
      )}

      {/* ------------------------------------------------------------ */}
      {/* History                                                       */}
      {/* ------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle>{topup.historyHeading}</CardTitle>
        </CardHeader>

        {historyError ? (
          <CardBody className="flex items-center gap-2 text-sm text-destructive">
            <ServerCrash aria-hidden className="size-4" />
            {historyError}
          </CardBody>
        ) : history === null ? (
          <CardBody className="flex flex-col gap-2">
            <span className="sr-only">{topup.loading}</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-10" />
            ))}
          </CardBody>
        ) : history.items.length === 0 ? (
          <CardBody>
            <p className="py-8 text-center text-sm text-subtle">{topup.historyEmpty}</p>
          </CardBody>
        ) : (
          <>
            <HistoryTable
              items={history.items}
              cancellingId={cancellingId}
              onCancel={(id) => void cancelRequest(id)}
            />
            <Pager page={history.page} totalPages={history.totalPages} onChange={setHistoryPage} />
          </>
        )}
      </Card>
    </div>
  );
}

function HistoryTable({
  items,
  cancellingId,
  onCancel,
}: {
  items: PaginatedTopups["items"];
  cancellingId: string | null;
  onCancel: (id: string) => void;
}) {
  const { historyColumns, viewSlip, cancelRequest: cancelLabel, cancelling } = walletMessages.topup;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-160 text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th scope="col" className="px-5 py-3 font-medium">
              {historyColumns.date}
            </th>
            <th scope="col" className="px-5 py-3 text-right font-medium">
              {historyColumns.amount}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {historyColumns.status}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {historyColumns.note}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              {historyColumns.slip}
            </th>
            <th scope="col" className="px-5 py-3 font-medium">
              <span className="sr-only">{historyColumns.action}</span>
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <tr key={item.id} className="transition-colors duration-150 hover:bg-background">
              <td className="tabular whitespace-nowrap px-5 py-3.5 text-muted">
                {formatDate(item.createdAt)}
              </td>
              <td className="tabular px-5 py-3.5 text-right font-semibold text-foreground">
                {formatBaht(item.amount)}
              </td>
              <td className="px-5 py-3.5">
                <TopupStatusBadge status={item.status} />
              </td>
              <td className="max-w-xs px-5 py-3.5 text-muted">{item.note ?? "—"}</td>
              <td className="px-5 py-3.5">
                {item.slipUrl ? (
                  <a
                    href={item.slipUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {viewSlip}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-right">
                {item.status === "PENDING" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={cancellingId !== null}
                    onClick={() => onCancel(item.id)}
                  >
                    {cancellingId === item.id ? cancelling : cancelLabel}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
