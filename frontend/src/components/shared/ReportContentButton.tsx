"use client";

import { useEffect, useRef, useState } from "react";
import { Flag } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { reportContent } from "@/lib/content-reports/api";
import type { ContentReportTargetType } from "@/lib/content-reports/types";
import { authMessages } from "@/lib/messages/auth";
import { contentReportMessages as messages } from "@/lib/messages/contentReports";

/**
 * A small "แจ้งเนื้อหาไม่เหมาะสม" link that opens a native `<dialog>` to collect
 * a reason before posting to POST /content-reports (scope 2.3.4).
 *
 * `<dialog>` rather than a Radix overlay for the same reason the slip review
 * modal uses one: focus trap, Escape and the backdrop for free, no dependency
 * (CLAUDE.md, ข้อห้าม 12).
 */
export function ReportContentButton({
  targetType,
  targetId,
}: {
  targetType: ContentReportTargetType;
  targetId: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (open) {
      dialogRef.current?.showModal();
    }
  }, [open]);

  function close(): void {
    dialogRef.current?.close();
    setOpen(false);
    setReason("");
    setError(null);
    setDone(false);
  }

  async function submit(): Promise<void> {
    if (reason.trim().length < 10) {
      setError(messages.dialogHelp);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await reportContent({ targetType, targetId, reason: reason.trim() });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-muted transition-colors duration-150 hover:text-destructive"
      >
        <Flag aria-hidden className="size-3.5" />
        {messages.reportButton}
      </button>

      {open && (
        <dialog
          ref={dialogRef}
          onClose={close}
          onCancel={close}
          aria-labelledby="report-content-dialog-title"
          className="m-auto w-[min(28rem,92vw)] rounded-card border border-border bg-card p-5 text-foreground backdrop:bg-foreground/40"
        >
          {done ? (
            <div className="flex flex-col gap-4">
              <Alert tone="success">{messages.success}</Alert>
              <Button type="button" block onClick={close}>
                {messages.close}
              </Button>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <h2 id="report-content-dialog-title" className="text-base font-semibold">
                {messages.dialogTitle}
              </h2>
              <p className="text-sm text-muted">{messages.dialogHelp}</p>

              {error && <Alert tone="error">{error}</Alert>}

              <Field id="report-reason" label={messages.reasonLabel}>
                <Textarea
                  id="report-reason"
                  rows={4}
                  minLength={10}
                  maxLength={500}
                  placeholder={messages.reasonPlaceholder}
                  value={reason}
                  onChange={(event) => {
                    setReason(event.target.value);
                    setError(null);
                  }}
                  required
                />
              </Field>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" disabled={submitting} onClick={close}>
                  {messages.cancel}
                </Button>
                <Button type="submit" variant="destructive" disabled={submitting}>
                  <Flag aria-hidden />
                  {submitting ? messages.submitting : messages.submit}
                </Button>
              </div>
            </form>
          )}
        </dialog>
      )}
    </>
  );
}
