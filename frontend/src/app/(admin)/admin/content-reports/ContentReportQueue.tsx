"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, RotateCcw, ServerCrash, ShieldAlert, ShieldOff, X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import {
  listContentReports,
  restoreCourseFromReport,
  reviewContentReport,
} from "@/lib/content-reports/api";
import type { ContentReport, ContentReportStatus } from "@/lib/content-reports/types";
import { formatCount, formatDateTime } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";

/**
 * The queue an admin works through to decide reported courses and Q&A
 * threads (scope 2.3.4). Only a COURSE report offers "suspend" — a
 * QNA_THREAD report is judged the same way but has nothing of its own to
 * hide, since the qna.controller.ts admin delete right already covers that.
 */
export function ContentReportQueue() {
  const { contentReports: messages } = adminMessages;
  const toast = useToast();

  const [status, setStatus] = useState<ContentReportStatus | "">("PENDING");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ContentReport[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listContentReports({
        status: status === "" ? undefined : status,
        page,
      });
      setItems(result.items);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(
    report: ContentReport,
    input: { status: "REVIEWED" | "DISMISSED"; suspendCourse?: boolean },
  ): Promise<void> {
    setBusyId(report.id);
    setError(null);
    try {
      await reviewContentReport(report.id, input);
      toast.success(messages.reviewedNotice);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setBusyId(null);
    }
  }

  async function restore(report: ContentReport): Promise<void> {
    setBusyId(report.id);
    setError(null);
    try {
      await restoreCourseFromReport(report.id);
      toast.success(messages.restoredNotice);
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{messages.title}</h1>
          <p className="mt-1 text-sm text-muted">{messages.subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          {total > 0 && (
            <Badge tone="pending">
              {formatCount(total)} {messages.pendingCount}
            </Badge>
          )}
          <Select
            aria-label={messages.filterAll}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as ContentReportStatus | "");
              setPage(1);
            }}
          >
            <option value="">{messages.filterAll}</option>
            <option value="PENDING">{messages.statusLabel.PENDING}</option>
            <option value="REVIEWED">{messages.statusLabel.REVIEWED}</option>
            <option value="DISMISSED">{messages.statusLabel.DISMISSED}</option>
          </Select>
        </div>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      {loading && items === null ? (
        <div className="flex flex-col gap-4">
          <span className="sr-only">{messages.loading}</span>
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-40 rounded-card" />
          ))}
        </div>
      ) : error && items === null ? (
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
      ) : items && items.length > 0 ? (
        <div className="flex flex-col gap-4">
          {items.map((report) => (
            <article
              key={report.id}
              className="flex flex-col gap-3 rounded-card border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{messages.targetType[report.targetType]}</Badge>
                  {report.courseStatus === "SUSPENDED" && (
                    <Badge tone="destructive">{messages.suspendedNotice}</Badge>
                  )}
                  <span className="tabular text-xs text-subtle">
                    {messages.reportedAt} {formatDateTime(report.createdAt)}
                  </span>
                </div>
                <Badge
                  tone={
                    report.status === "PENDING"
                      ? "pending"
                      : report.status === "REVIEWED"
                        ? "success"
                        : "neutral"
                  }
                >
                  {messages.statusLabel[report.status]}
                </Badge>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-subtle sm:grid-cols-3">
                <div>
                  <dt>{messages.reporterLabel}</dt>
                  <dd className="text-foreground">{report.reporter.displayName}</dd>
                </div>
                <div>
                  <dt>{messages.targetIdLabel}</dt>
                  <dd className="break-all text-foreground">{report.targetId}</dd>
                </div>
                {report.targetType === "COURSE" && (
                  <div>
                    <dt>{messages.viewCourse}</dt>
                    <dd>
                      <Link
                        href={`/courses/${report.targetId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        {messages.viewCourse}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>

              <div>
                <p className="text-xs text-subtle">{messages.reasonLabel}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{report.reason}</p>
              </div>

              {report.status === "PENDING" && (
                <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                  {report.targetType === "COURSE" ? (
                    <>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={busyId !== null}
                        onClick={() =>
                          void decide(report, { status: "REVIEWED", suspendCourse: true })
                        }
                      >
                        <ShieldAlert aria-hidden />
                        {busyId === report.id ? messages.suspending : messages.suspendCourse}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busyId !== null}
                        onClick={() => void decide(report, { status: "REVIEWED" })}
                      >
                        <ShieldOff aria-hidden />
                        {messages.markReviewedOnly}
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId !== null}
                      onClick={() => void decide(report, { status: "REVIEWED" })}
                    >
                      <Check aria-hidden />
                      {messages.markReviewedOnly}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busyId !== null}
                    onClick={() => void decide(report, { status: "DISMISSED" })}
                  >
                    <X aria-hidden />
                    {busyId === report.id ? messages.dismissing : messages.dismiss}
                  </Button>
                </div>
              )}

              {report.targetType === "COURSE" && report.status === "PENDING" && (
                <p className="text-xs text-subtle">{messages.suspendHint}</p>
              )}

              {report.courseStatus === "SUSPENDED" && (
                <div className="flex border-t border-border pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId !== null}
                    onClick={() => void restore(report)}
                  >
                    <RotateCcw aria-hidden />
                    {busyId === report.id ? messages.restoring : messages.restoreCourse}
                  </Button>
                </div>
              )}
            </article>
          ))}

          <Pager page={page} totalPages={totalPages} disabled={loading} onChange={setPage} />
        </div>
      ) : (
        <EmptyState icon={ShieldAlert} title={messages.emptyTitle} body={messages.emptyBody} />
      )}
    </div>
  );
}
