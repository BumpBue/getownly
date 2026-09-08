"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PayoutStatusBadge } from "@/components/shared/PayoutStatusBadge";
import { ApiError } from "@/lib/api-client";
import { formatBaht, formatDateTime } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { payoutMessages } from "@/lib/messages/payouts";
import { approvePayout, readPayoutForAdmin, rejectPayout } from "@/lib/payouts/api";
import type { AdminPayoutRequest } from "@/lib/payouts/types";

/**
 * The account number to transfer to, beside the amount and who is owed it.
 *
 * A native `<dialog>` rather than a Radix overlay: it gives the focus trap, the
 * Escape key and the backdrop for free, with no dependency (CLAUDE.md, ข้อห้าม 12).
 *
 * The request is fetched here rather than handed down from the queue, because
 * this is the only screen allowed the unmasked number. Keeping it out of the
 * listing means it reaches the browser when somebody opens a row to make a
 * transfer, and not while they are scrolling past twenty of them.
 */
export function ReviewPayoutDialog({
  payoutRequestId,
  onClose,
  onReviewed,
}: {
  payoutRequestId: string;
  onClose: () => void;
  onReviewed: (message: string) => void;
}) {
  const labels = payoutMessages.admin;
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [request, setRequest] = useState<AdminPayoutRequest | null>(null);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    // showModal() is what makes it modal; rendering <dialog open> does not.
    dialogRef.current?.showModal();
  }, []);

  useEffect(() => {
    void readPayoutForAdmin(payoutRequestId)
      .then(setRequest)
      .catch((cause: unknown) =>
        setError(cause instanceof ApiError ? cause.message : labels.loadFailed),
      );
  }, [labels.loadFailed, payoutRequestId]);

  const run = useCallback(
    async (action: "approve" | "reject") => {
      if (action === "reject" && note.trim().length === 0) {
        setNoteError(labels.dialogRejectNote);
        return;
      }
      if (action === "approve" && !window.confirm(labels.dialogApproveConfirm)) {
        return;
      }

      setBusy(action);
      setError(null);

      try {
        if (action === "approve") {
          await approvePayout(payoutRequestId);
          onReviewed(labels.approved);
        } else {
          await rejectPayout(payoutRequestId, note.trim());
          onReviewed(labels.rejected);
        }
      } catch (cause) {
        setError(cause instanceof ApiError ? cause.message : authMessages.errors.unexpected);
      } finally {
        setBusy(null);
      }
    },
    [labels, note, onReviewed, payoutRequestId],
  );

  const pending = request?.status === "PENDING";

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      className="w-[min(40rem,calc(100vw-2rem))] rounded-card border border-border bg-card p-0 backdrop:bg-foreground/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{labels.dialogTitle}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label={labels.dialogClose}>
          <X aria-hidden className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {!request ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <PayoutStatusBadge status={request.status} />
              <span className="text-xs text-muted">{formatDateTime(request.createdAt)}</span>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">{labels.dialogAmountHeading}</dt>
                <dd className="text-2xl font-semibold tabular-nums text-secondary">
                  {formatBaht(request.amount)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{labels.dialogInstructorHeading}</dt>
                <dd className="text-sm text-foreground">{request.instructor.displayName}</dd>
                <dt className="mt-2 text-xs text-muted">{labels.dialogBalanceHeading}</dt>
                <dd className="text-sm tabular-nums text-muted">
                  {formatBaht(request.instructor.walletBalance)}
                </dd>
              </div>
            </dl>

            <div className="rounded-control border border-border bg-background px-4 py-3">
              <p className="text-xs text-muted">{labels.dialogAccountHeading}</p>
              <p className="mt-1 text-sm text-foreground">{request.bankName}</p>
              <p className="text-sm text-foreground">{request.accountName}</p>
              <p className="text-lg font-semibold tabular-nums text-foreground">
                {request.accountNumber}
              </p>
              <p className="mt-1 text-xs text-subtle">{labels.dialogAccountNotice}</p>
            </div>

            {pending ? (
              <>
                <Alert tone="pending">{labels.dialogHeldNotice}</Alert>

                <Field
                  id="payout-note"
                  label={labels.dialogRejectNote}
                  error={noteError ?? undefined}
                >
                  <Textarea
                    id="payout-note"
                    rows={2}
                    value={note}
                    placeholder={labels.dialogRejectNotePlaceholder}
                    onChange={(event) => {
                      setNote(event.target.value);
                      setNoteError(null);
                    }}
                  />
                </Field>

                <div className="flex flex-wrap gap-2">
                  <Button disabled={busy !== null} onClick={() => void run("approve")}>
                    <Check aria-hidden className="size-4" />
                    {labels.dialogApprove}
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => void run("reject")}
                  >
                    {labels.dialogReject}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Alert tone="info">{labels.dialogReviewedNotice}</Alert>
                {request.note ? <p className="text-sm text-muted">{request.note}</p> : null}
              </>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}
