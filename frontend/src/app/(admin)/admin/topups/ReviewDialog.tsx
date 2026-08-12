"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ExternalLink, ImageOff, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { TopupStatusBadge } from "@/components/shared/TopupStatusBadge";
import { ApiError } from "@/lib/api-client";
import { formatBaht, formatCount, formatDateTime } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { walletMessages } from "@/lib/messages/wallet";
import { approveTopup, rejectTopup } from "@/lib/wallet/api";
import { fromSatang, toSatang } from "@/lib/money";
import type { AdminTopupRequest } from "@/lib/wallet/types";

/**
 * The slip, large, beside who sent it and what they claim it is worth.
 *
 * A native `<dialog>` rather than a Radix overlay: it gives the focus trap, the
 * Escape key and the backdrop for free, with no dependency (CLAUDE.md, ข้อห้าม 12).
 */
export function ReviewDialog({
  request,
  onClose,
  onReviewed,
}: {
  request: AdminTopupRequest;
  onClose: () => void;
  onReviewed: (message: string) => void;
}) {
  const labels = walletMessages.admin.topups;
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const pending = request.status === "PENDING";

  useEffect(() => {
    // showModal() is what makes it modal; rendering <dialog open> does not.
    dialogRef.current?.showModal();
  }, []);

  const run = useCallback(
    async (action: "approve" | "reject") => {
      if (action === "reject" && note.trim().length === 0) {
        setNoteError(labels.rejectNoteRequired);
        return;
      }

      setBusy(action);
      setError(null);

      try {
        if (action === "approve") {
          await approveTopup(request.id);
          onReviewed(labels.approveSuccess);
        } else {
          await rejectTopup(request.id, note.trim());
          onReviewed(labels.rejectSuccess);
        }
      } catch (caught) {
        setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
        setBusy(null);
      }
    },
    [note, request.id, onReviewed, labels],
  );

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onCancel={onClose}
      aria-labelledby="review-dialog-title"
      className="m-auto w-[min(64rem,92vw)] rounded-card border border-border bg-card p-0 text-foreground backdrop:bg-foreground/40"
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <h2 id="review-dialog-title" className="text-base font-semibold">
          {labels.modalTitle}
        </h2>
        <button
          type="button"
          aria-label={labels.close}
          onClick={() => dialogRef.current?.close()}
          className="rounded-control p-1.5 text-muted transition-colors duration-150 hover:bg-background hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>

      <div className="grid max-h-[70vh] gap-5 overflow-y-auto p-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---------------------------------------------------------- */}
        {/* The slip, as large as the dialog allows                     */}
        {/* ---------------------------------------------------------- */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-muted">{labels.slipHeading}</h3>

          {request.slipUrl ? (
            <>
              {/* A photo of unknown dimensions behind a signed URL that
                  expires; next/image would need a fixed size and gains
                  nothing here. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={request.slipUrl}
                alt={walletMessages.topup.slipPreviewAlt}
                className="max-h-[52vh] w-full rounded-control border border-border bg-background object-contain"
              />
              <a
                href={request.slipUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
              >
                <ExternalLink aria-hidden className="size-3.5" />
                {labels.slipOpenFull}
              </a>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-control border border-border bg-background py-16 text-subtle">
              <ImageOff aria-hidden className="size-8" />
              <span className="text-sm">{labels.slipMissing}</span>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- */}
        {/* Payer, amount, decision                                     */}
        {/* ---------------------------------------------------------- */}
        <section className="flex flex-col gap-4">
          <div className="rounded-card border border-border bg-background p-4">
            <p className="text-xs text-muted">{labels.claimedAmount}</p>
            <p className="tabular mt-1 text-3xl font-bold text-secondary">
              {formatBaht(request.amount)}
            </p>
            <p className="tabular mt-1 text-xs text-subtle">
              {labels.requestedAt} {formatDateTime(request.createdAt)}
            </p>
          </div>

          <dl className="divide-y divide-border rounded-card border border-border text-sm">
            <Row label={labels.payerName} value={request.student.displayName} />
            <Row label={labels.payerUsername} value={request.student.username} />
            <Row label={labels.payerEmail} value={request.student.email} />
            <Row
              label={labels.payerBalance}
              value={formatBaht(request.studentWalletBalance)}
              tabular
            />
            <Row
              label={labels.payerApprovedCount}
              value={`${formatCount(request.studentApprovedCount)} ${labels.timesSuffix}`}
              tabular
            />
            <Row
              label={labels.balanceAfter}
              value={formatBaht(
                fromSatang(toSatang(request.studentWalletBalance) + toSatang(request.amount)),
              )}
              tabular
            />
          </dl>

          {error && <Alert tone="error">{error}</Alert>}

          {pending ? (
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                block
                size="lg"
                disabled={busy !== null}
                onClick={() => void run("approve")}
              >
                <Check aria-hidden />
                {busy === "approve" ? labels.approving : labels.approve}
              </Button>

              <Field id="reject-note" label={labels.rejectNoteLabel} error={noteError ?? undefined}>
                <Textarea
                  id="reject-note"
                  rows={3}
                  placeholder={labels.rejectNotePlaceholder}
                  value={note}
                  invalid={noteError !== null}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setNoteError(null);
                  }}
                />
              </Field>

              <Button
                type="button"
                block
                variant="destructive"
                disabled={busy !== null}
                onClick={() => void run("reject")}
              >
                <X aria-hidden />
                {busy === "reject" ? labels.rejecting : labels.reject}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 rounded-control border border-border bg-background px-3 py-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted">
                  {request.status === "CANCELLED" ? labels.cancelledNotice : labels.reviewedNotice}
                </span>
                <TopupStatusBadge status={request.status} />
              </div>
              {request.note && <p className="text-muted">{request.note}</p>}
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
}

function Row({ label, value, tabular }: { label: string; value: string; tabular?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={`text-right font-medium text-foreground ${tabular ? "tabular" : "break-all"}`}>
        {value}
      </dd>
    </div>
  );
}
