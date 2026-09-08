"use client";

import { useCallback, useEffect, useState } from "react";
import { Banknote, Inbox, Pencil, ServerCrash, Wallet } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { BankLogo } from "@/components/shared/BankLogo";
import { BankSelect } from "@/components/shared/BankSelect";
import { EmptyState } from "@/components/shared/EmptyState";
import { PayoutStatusBadge } from "@/components/shared/PayoutStatusBadge";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { formatBaht, formatDateTime } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { payoutMessages } from "@/lib/messages/payouts";
import { toSatang } from "@/lib/money";
import {
  cancelPayout,
  getBankAccount,
  getPayoutOverview,
  listMyPayouts,
  saveBankAccount,
  submitPayout,
} from "@/lib/payouts/api";
import type { BankAccount, PaginatedPayouts, PayoutOverview } from "@/lib/payouts/types";

const HISTORY_PAGE_SIZE = 10;

/**
 * The instructor's withdrawal page.
 *
 * A client component rather than a Server Component, for the reason the whole
 * of `/my-courses` is one: `serverFetch` cannot rotate a refresh token, so a
 * fifteen-minute access token would turn this into an error page (CLAUDE.md,
 * เฟส 6).
 */
export function PayoutsView() {
  const labels = payoutMessages.instructor;
  const toast = useToast();

  const [overview, setOverview] = useState<PayoutOverview | null>(null);
  const [history, setHistory] = useState<PaginatedPayouts | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editingBank, setEditingBank] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextOverview, nextHistory] = await Promise.all([
        getPayoutOverview(),
        listMyPayouts(1, HISTORY_PAGE_SIZE),
      ]);
      setOverview(nextOverview);
      setHistory(nextHistory);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!overview) return;

    const requested = amount.trim();
    if (requested.length === 0) {
      setAmountError(labels.amountLabel);
      return;
    }

    // A local check for the sake of the person typing; the balance and the
    // floor are both decided again on the server, after the row is locked.
    if (toSatang(requested) < toSatang(overview.minimumAmount)) {
      setAmountError(labels.minimumNotice(formatBaht(overview.minimumAmount)));
      return;
    }
    if (toSatang(requested) > toSatang(overview.withdrawableAmount)) {
      setAmountError(
        `${labels.withdrawableLabel} ${formatBaht(overview.withdrawableAmount)} บาท`,
      );
      return;
    }

    setSubmitting(true);
    setAmountError(null);

    try {
      await submitPayout(requested);
      setAmount("");
      toast.success(labels.submitted);
      await load();
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : authMessages.errors.unexpected;
      setAmountError(message);
    } finally {
      setSubmitting(false);
    }
  }, [amount, labels, load, overview, toast]);

  const cancel = useCallback(async () => {
    if (!overview?.pendingRequest) return;
    if (!window.confirm(labels.cancelConfirm)) return;

    try {
      await cancelPayout(overview.pendingRequest.id);
      toast.success(labels.cancelled);
      await load();
    } catch (cause) {
      toast.error(cause instanceof ApiError ? cause.message : authMessages.errors.unexpected);
    }
  }, [labels, load, overview, toast]);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title={labels.title} subtitle={labels.subtitle} />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col gap-6">
        <SectionHeading title={labels.title} subtitle={labels.subtitle} />
        <EmptyState
          icon={ServerCrash}
          title={labels.loadFailed}
          body={error ?? undefined}
          action={<Button onClick={() => void load()}>{labels.retry}</Button>}
        />
      </div>
    );
  }

  const pending = overview.pendingRequest;
  const canSubmit = Boolean(overview.bankAccount) && !pending;

  return (
    <div className="flex flex-col gap-6">
      <SectionHeading title={labels.title} subtitle={labels.subtitle} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-sm text-muted">
              <Wallet aria-hidden className="size-4" />
              {labels.balanceLabel}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-foreground">
              {formatBaht(overview.walletBalance)}
            </span>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-sm text-muted">
              <Banknote aria-hidden className="size-4" />
              {labels.withdrawableLabel}
            </span>
            <span className="text-2xl font-semibold tabular-nums text-secondary">
              {formatBaht(overview.withdrawableAmount)}
            </span>
            {/*
              The two figures are always equal under this design, and saying so
              is the point: a reader who has just seen their balance drop needs
              to know nothing is being held back from them.
            */}
            <span className="text-xs text-subtle">{labels.sameAsBalance}</span>
          </CardBody>
        </Card>
      </div>

      {pending ? (
        <Alert tone="pending">{labels.pendingNotice(formatBaht(pending.amount))}</Alert>
      ) : null}

      <BankAccountCard
        account={overview.bankAccount}
        editing={editingBank}
        onEdit={() => setEditingBank(true)}
        onDone={async () => {
          setEditingBank(false);
          await load();
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{labels.formTitle}</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {!overview.bankAccount ? (
            <Alert tone="pending">{labels.bankEmptyHint}</Alert>
          ) : null}

          <Field label={labels.amountLabel} error={amountError ?? undefined} id="payout-amount">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="payout-amount"
                inputMode="decimal"
                value={amount}
                disabled={!canSubmit || submitting}
                onChange={(event) => {
                  setAmount(event.target.value);
                  setAmountError(null);
                }}
                className="tabular-nums"
              />
              <Button
                type="button"
                variant="outline"
                disabled={!canSubmit || submitting}
                onClick={() => setAmount(overview.withdrawableAmount)}
              >
                {labels.withdrawAll}
              </Button>
            </div>
          </Field>

          <p className="text-xs text-subtle">
            {labels.minimumNotice(formatBaht(overview.minimumAmount))} · {labels.oneAtATime} ·{" "}
            {labels.reviewTargetNotice}
          </p>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={!canSubmit || submitting} onClick={() => void submit()}>
              {submitting ? labels.submitting : labels.submit}
            </Button>
            {pending ? (
              <Button type="button" variant="outline" onClick={() => void cancel()}>
                {labels.cancel}
              </Button>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <PayoutHistory history={history} />
    </div>
  );
}

/**
 * The saved bank details, and the form that edits them.
 *
 * The unmasked number is fetched only when the form is opened — the page-level
 * overview carries the masked one, so the real number is not sitting in the
 * browser for a screen that is only displaying it.
 */
function BankAccountCard({
  account,
  editing,
  onEdit,
  onDone,
}: {
  account: PayoutOverview["bankAccount"];
  editing: boolean;
  onEdit: () => void;
  onDone: () => Promise<void>;
}) {
  const labels = payoutMessages.instructor;
  const toast = useToast();

  const [form, setForm] = useState({ bankCode: "", accountName: "", accountNumber: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);

  useEffect(() => {
    if (!editing) return;

    setLoadingExisting(true);
    void getBankAccount()
      .then((existing: BankAccount | null) => {
        if (existing) {
          setForm({
            bankCode: existing.bankCode,
            accountName: existing.accountName,
            accountNumber: existing.accountNumber,
          });
        }
      })
      .catch(() => setForm({ bankCode: "", accountName: "", accountNumber: "" }))
      .finally(() => setLoadingExisting(false));
  }, [editing]);

  const save = useCallback(async () => {
    if (form.bankCode.length === 0) {
      setError(labels.bankSelectPlaceholder);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await saveBankAccount(form);
      toast.success(labels.bankSaved);
      await onDone();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : authMessages.errors.unexpected);
    } finally {
      setBusy(false);
    }
  }, [form, labels.bankSaved, labels.bankSelectPlaceholder, onDone, toast]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{labels.bankTitle}</CardTitle>
        {!editing ? (
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Pencil aria-hidden className="size-4" />
            {account ? labels.bankEdit : labels.bankAdd}
          </Button>
        ) : null}
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        {editing ? (
          loadingExisting ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <>
              {error ? <Alert tone="error">{error}</Alert> : null}

              <Field label={labels.bankNameLabel} id="bank-name">
                <BankSelect
                  id="bank-name"
                  value={form.bankCode}
                  onChange={(bankCode) => setForm({ ...form, bankCode })}
                />
              </Field>
              <Field label={labels.accountNameLabel} id="account-name">
                <Input
                  id="account-name"
                  value={form.accountName}
                  onChange={(event) => setForm({ ...form, accountName: event.target.value })}
                />
              </Field>
              <Field
                label={labels.accountNumberLabel}
                hint={labels.accountNumberHint}
                id="account-number"
              >
                <Input
                  id="account-number"
                  inputMode="numeric"
                  value={form.accountNumber}
                  onChange={(event) => setForm({ ...form, accountNumber: event.target.value })}
                  className="tabular-nums"
                />
              </Field>

              <p className="text-xs text-subtle">{labels.bankMaskNotice}</p>

              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void save()}>
                  {labels.bankSave}
                </Button>
                <Button type="button" variant="outline" onClick={() => void onDone()}>
                  {labels.bankCancel}
                </Button>
              </div>
            </>
          )
        ) : account ? (
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted">{labels.bankNameLabel}</dt>
              <dd className="flex items-center gap-2 text-sm text-foreground">
                <BankLogo code={account.bankCode} size="sm" />
                {account.bankName}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{labels.accountNameLabel}</dt>
              <dd className="text-sm text-foreground">{account.accountName}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">{labels.accountNumberLabel}</dt>
              <dd className="text-sm tabular-nums text-foreground">
                {account.accountNumberMasked}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-muted">{labels.bankEmpty}</p>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Past requests.
 *
 * Collapses to one card per request below `md`, the pattern every table in this
 * application uses on a narrow screen: a six-column table at 375px hides the
 * column the reader opened the page for (CLAUDE.md, D8).
 */
function PayoutHistory({ history }: { history: PaginatedPayouts | null }) {
  const labels = payoutMessages.instructor;

  if (!history || history.items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{labels.historyTitle}</CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState icon={Inbox} title={labels.historyEmpty} />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{labels.historyTitle}</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        <ul className="flex flex-col divide-y divide-border md:hidden">
          {history.items.map((item) => (
            <li key={item.id} className="flex flex-col gap-2 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-lg font-semibold tabular-nums text-foreground">
                  {formatBaht(item.amount)}
                </span>
                <PayoutStatusBadge status={item.status} />
              </div>
              <span className="text-xs text-muted">{formatDateTime(item.createdAt)}</span>
              <span className="flex items-center gap-2 text-xs tabular-nums text-muted">
                <BankLogo code={item.bankAccount.bankCode} size="sm" />
                {item.bankAccount.bankName} · {item.bankAccount.accountNumberMasked}
              </span>
              {item.note ? <span className="text-xs text-destructive">{item.note}</span> : null}
            </li>
          ))}
        </ul>

        <div className="hidden md:block">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted">
              <tr>
                <th className="px-5 py-2.5 font-medium">{labels.columnDate}</th>
                <th className="px-5 py-2.5 font-medium">{labels.columnAmount}</th>
                <th className="px-5 py-2.5 font-medium">{labels.columnAccount}</th>
                <th className="px-5 py-2.5 font-medium">{labels.columnStatus}</th>
                <th className="px-5 py-2.5 font-medium">{labels.columnNote}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-5 py-3 text-muted">{formatDateTime(item.createdAt)}</td>
                  <td className="px-5 py-3 font-medium tabular-nums text-foreground">
                    {formatBaht(item.amount)}
                  </td>
                  <td className="px-5 py-3 text-muted">
                    <span className="flex items-center gap-2 tabular-nums">
                      <BankLogo code={item.bankAccount.bankCode} size="sm" />
                      {item.bankAccount.bankName} · {item.bankAccount.accountNumberMasked}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <PayoutStatusBadge status={item.status} />
                  </td>
                  <td className="px-5 py-3 text-muted">{item.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
