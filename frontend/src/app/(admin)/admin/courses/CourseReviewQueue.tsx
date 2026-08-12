"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookCheck,
  Check,
  CircleAlert,
  ImageOff,
  ServerCrash,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { ApiError } from "@/lib/api-client";
import { approveCourse, listPendingCourses, rejectCourse } from "@/lib/admin/api";
import type { PaginatedPendingCourses, PendingCourse } from "@/lib/admin/types";
import { formatBaht, formatClock, formatCount, formatDateTime, formatDuration } from "@/lib/format";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";
import { courseMessages } from "@/lib/messages/courses";

/**
 * The approval queue.
 *
 * Each card carries the whole curriculum rather than a link to it, because the
 * decision being made here is about content and a queue that hides the content
 * is a rubber stamp.
 */
export function CourseReviewQueue() {
  const { courses: messages } = adminMessages;

  const [data, setData] = useState<PaginatedPendingCourses | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await listPendingCourses(page));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (action: "approve" | "reject", course: PendingCourse) => {
    setBusy(action);
    setError(null);
    setNotice(null);

    try {
      if (action === "approve") {
        await approveCourse(course.id);
        setNotice(messages.approvedNotice);
      } else {
        await rejectCourse(course.id, reason.trim());
        setNotice(messages.rejectedNotice);
      }
      setRejecting(null);
      setReason("");
      // The card leaves the queue either way, so the list is re-read.
      await load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{messages.title}</h1>
          <p className="mt-1 text-sm text-muted">{messages.subtitle}</p>
        </div>

        {data && data.total > 0 && (
          <Badge tone="pending">
            {formatCount(data.total)} {messages.pendingCount}
          </Badge>
        )}
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {loading && data === null ? (
        <div className="flex flex-col gap-4">
          <span className="sr-only">{messages.loading}</span>
          {Array.from({ length: 2 }, (_, index) => (
            <Skeleton key={index} className="h-72 rounded-card" />
          ))}
        </div>
      ) : error && data === null ? (
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
      ) : data && data.items.length > 0 ? (
        <div className="flex flex-col gap-4">
          {data.items.map((course) => (
            <article
              key={course.id}
              className="overflow-hidden rounded-card border border-border bg-card"
            >
              <div className="flex flex-col gap-4 p-5 sm:flex-row">
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-control border border-border bg-background sm:w-48">
                  {course.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- signed URL of unknown dimensions, same as the slip review
                    <img
                      src={course.coverUrl}
                      alt={course.title}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-1 text-subtle">
                      <ImageOff aria-hidden className="size-5" />
                      <span className="text-xs">{courseMessages.card.noCover}</span>
                    </span>
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h2 className="text-lg font-semibold leading-snug text-foreground">
                    {course.title}
                  </h2>

                  <p className="line-clamp-3 text-sm text-muted">{course.description}</p>

                  <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-subtle sm:grid-cols-4">
                    <Field label={messages.instructorLabel} value={course.instructor.displayName} />
                    <Field label={messages.categoryLabel} value={course.category.name} />
                    <Field label={messages.priceLabel} value={formatBaht(course.price)} />
                    <Field
                      label={messages.lessonsLabel}
                      value={`${formatCount(course.lessonCount)} · ${formatDuration(course.totalDurationSec)}`}
                    />
                  </dl>

                  <p className="tabular text-xs text-subtle">
                    {messages.submittedAt} {formatDateTime(course.submittedAt)}
                  </p>

                  {course.lessonsWithVideo < course.lessonCount && (
                    <p className="flex items-center gap-1.5 text-xs text-pending">
                      <CircleAlert aria-hidden className="size-3.5" />
                      {formatCount(course.lessonsWithVideo)}/{formatCount(course.lessonCount)}{" "}
                      {messages.withVideoSuffix}
                    </p>
                  )}
                </div>
              </div>

              <details className="border-t border-border">
                <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-primary">
                  {messages.curriculumHeading}
                </summary>
                <ol className="divide-y divide-border border-t border-border">
                  {course.lessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="flex items-center gap-3 px-5 py-2.5 text-sm text-foreground"
                    >
                      {lesson.hasVideo ? (
                        <Video aria-hidden className="size-4 shrink-0 text-success" />
                      ) : (
                        <VideoOff aria-hidden className="size-4 shrink-0 text-pending" />
                      )}
                      <span className="tabular text-xs text-subtle">{lesson.orderIndex}.</span>
                      <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      <span className="tabular shrink-0 text-xs text-subtle">
                        {lesson.hasVideo ? formatClock(lesson.durationSec) : messages.noVideo}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>

              {rejecting === course.id ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void decide("reject", course);
                  }}
                  className="flex flex-col gap-3 border-t border-border bg-background px-5 py-4"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      {messages.rejectTitle}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted">{messages.rejectHelp}</p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`reason-${course.id}`}>{messages.rejectLabel}</Label>
                    <Textarea
                      id={`reason-${course.id}`}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder={messages.rejectPlaceholder}
                      rows={3}
                      minLength={10}
                      maxLength={500}
                      required
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" variant="destructive" disabled={busy !== null}>
                      <X aria-hidden />
                      {busy === "reject" ? messages.rejecting : messages.confirmReject}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={busy !== null}
                      onClick={() => {
                        setRejecting(null);
                        setReason("");
                      }}
                    >
                      {messages.cancel}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-wrap gap-2 border-t border-border px-5 py-4">
                  <Button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void decide("approve", course)}
                  >
                    <Check aria-hidden />
                    {busy === "approve" ? messages.approving : messages.approve}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy !== null}
                    onClick={() => setRejecting(course.id)}
                  >
                    <X aria-hidden />
                    {messages.reject}
                  </Button>
                </div>
              )}
            </article>
          ))}

          <Pager
            page={data.page}
            totalPages={data.totalPages}
            disabled={loading}
            onChange={setPage}
          />
        </div>
      ) : (
        <EmptyState icon={BookCheck} title={messages.emptyTitle} body={messages.emptyBody} />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-subtle">{label}</dt>
      <dd className="truncate text-foreground">{value}</dd>
    </div>
  );
}
