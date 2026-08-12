"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  ExternalLink,
  EyeOff,
  ServerCrash,
  Send,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CourseStatusBadge } from "@/components/shared/CourseStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { deleteCourse, getCourse, submitCourse, unpublishCourse } from "@/lib/catalog/api";
import type { CourseDetail } from "@/lib/catalog/types";
import { authMessages } from "@/lib/messages/auth";
import { instructorMessages } from "@/lib/messages/instructor";
import { cn } from "@/lib/utils";
import { CurriculumTab } from "./CurriculumTab";
import { GeneralTab } from "./GeneralTab";

const TAB_IDS = ["general", "curriculum", "quizzes"] as const;
type TabId = (typeof TAB_IDS)[number];

/**
 * The course editor.
 *
 * Owns the course record and hands it to whichever tab is showing. `readOnly`
 * comes from the status: while an admin is reviewing a course, nothing about
 * it may change, and the API enforces the same rule regardless of what this
 * page renders.
 */
export default function CourseEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const courseId = params.id;

  const { editor } = instructorMessages;

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("general");
  const [notice, setNotice] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCourse(await getCourse(courseId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmitForReview(): Promise<void> {
    setSubmitting(true);
    setNotice(null);
    setError(null);
    setMissing([]);

    try {
      setCourse(await submitCourse(courseId));
      setNotice(editor.submitSuccess);
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        // COURSE_INCOMPLETE names exactly what is still missing, which is far
        // more useful than the generic sentence on its own.
        setMissing(readMissing(caught.details));
      } else {
        setError(authMessages.errors.unexpected);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function onUnpublish(): Promise<void> {
    if (!window.confirm(editor.unpublishConfirm)) {
      return;
    }

    setUnpublishing(true);
    setNotice(null);
    setError(null);

    try {
      setCourse(await unpublishCourse(courseId));
      setNotice(editor.unpublishSuccess);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setUnpublishing(false);
    }
  }

  async function onDelete(): Promise<void> {
    if (!window.confirm(editor.deleteConfirm)) {
      return;
    }

    setError(null);
    try {
      await deleteCourse(courseId);
      router.push("/instructor");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    }
  }

  if (error && !course) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState icon={ServerCrash} tone="destructive" title={editor.errorTitle} body={error} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <span className="sr-only">{editor.loading}</span>
        <Skeleton className="h-10 w-96" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96 rounded-card" />
      </div>
    );
  }

  const readOnly = course.status === "PENDING_REVIEW";
  const canSubmit = course.status === "DRAFT" || course.status === "REJECTED";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <Link
        href="/instructor"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-primary"
      >
        <ArrowRight aria-hidden className="size-4 rotate-180" />
        {editor.backToDashboard}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <CourseStatusBadge status={course.status} />
            <span className="text-xs text-muted">{course.category.name}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-primary">{course.title}</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {course.status === "PUBLISHED" && (
            <Button asChild variant="outline">
              <Link href={`/courses/${course.id}`}>
                <ExternalLink aria-hidden />
                {editor.viewPublicPage}
              </Link>
            </Button>
          )}

          {course.status === "PUBLISHED" && (
            <Button
              variant="outline"
              disabled={unpublishing}
              onClick={() => void onUnpublish()}
              className="text-destructive"
            >
              <EyeOff aria-hidden />
              {unpublishing ? editor.unpublishing : editor.unpublishCourse}
            </Button>
          )}

          {course.status === "DRAFT" && (
            <Button variant="ghost" onClick={() => void onDelete()} className="text-destructive">
              <Trash2 aria-hidden />
              {editor.deleteCourse}
            </Button>
          )}

          {canSubmit && (
            <Button disabled={submitting} onClick={() => void onSubmitForReview()}>
              <Send aria-hidden />
              {submitting ? editor.submitting : editor.submitForReview}
            </Button>
          )}
        </div>
      </header>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && (
        <Alert tone="error">
          <span>
            {error}
            {missing.length > 0 && (
              <span className="mt-1.5 block">
                {editor.missingPrefix}
                <ul className="mt-1 list-inside list-disc font-medium">
                  {missing.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </span>
            )}
          </span>
        </Alert>
      )}
      {readOnly && <Alert tone="pending">{editor.lockedNotice}</Alert>}
      {course.status === "UNPUBLISHED" && <Alert tone="pending">{editor.unpublishedNotice}</Alert>}
      {course.status === "REJECTED" && (
        <Alert tone="error">
          <span>
            {editor.rejectedNotice}
            {course.rejectReason && (
              <span className="mt-1 block font-medium">{course.rejectReason}</span>
            )}
          </span>
        </Alert>
      )}
      {canSubmit && !readOnly && <p className="text-xs text-subtle">{editor.submitHint}</p>}

      <nav className="flex gap-1 border-b border-border" aria-label={editor.tabs.general}>
        {TAB_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {editor.tabs[id]}
          </button>
        ))}
      </nav>

      {tab === "general" && (
        <GeneralTab course={course} readOnly={readOnly} onSaved={setCourse} />
      )}
      {tab === "curriculum" && <CurriculumTab courseId={course.id} readOnly={readOnly} />}
      {tab === "quizzes" && (
        <EmptyState
          icon={ClipboardList}
          title={instructorMessages.quizzes.comingSoonTitle}
          body={instructorMessages.quizzes.comingSoonBody}
        />
      )}
    </div>
  );
}

/** Pulls the `missing` list out of a COURSE_INCOMPLETE error body. */
function readMissing(details: Record<string, unknown> | undefined): string[] {
  const missing = details?.missing;
  return Array.isArray(missing) ? missing.filter((item): item is string => typeof item === "string") : [];
}
