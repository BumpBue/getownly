"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Lock, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatClock } from "@/lib/format";
import { courseMessages } from "@/lib/messages/courses";
import type { CourseDetail } from "@/lib/catalog/types";
import { PreviewDialog } from "./PreviewDialog";

type Lesson = CourseDetail["lessons"][number];

/**
 * The lesson list on a course page, where a free preview can be played.
 *
 * Only a preview row is interactive, and it is interactive as a real control:
 * a `<button>` for somebody signed in, a `<Link>` to the sign-in page for
 * somebody who is not. Both are reachable by keyboard and announced as what
 * they are.
 *
 * Every other row is inert markup with no hover response. That is a fix, not
 * an omission: the list used to tint every row on hover and brighten the play
 * icon with it, so all of them looked clickable and none of them were. The
 * affordance now belongs to exactly the rows that have something behind it.
 */
export function CurriculumList({
  courseId,
  lessons,
  isSignedIn,
}: {
  courseId: string;
  lessons: Lesson[];
  /** Guests are sent to sign in first: the stream endpoint requires a session. */
  isSignedIn: boolean;
}) {
  const { detail } = courseMessages;
  const [previewing, setPreviewing] = useState<Lesson | null>(null);

  return (
    <>
      <ul className="divide-y divide-border">
        {lessons.map((lesson) => {
          const body = (
            <>
              {lesson.isPreview ? (
                <PlayCircle aria-hidden className="size-4 shrink-0 text-primary" />
              ) : (
                <Lock aria-hidden className="size-4 shrink-0 text-subtle" />
              )}

              <span className="tabular w-7 shrink-0 text-xs text-subtle">{lesson.orderIndex}</span>

              <span className="flex-1 text-left text-sm text-foreground">{lesson.title}</span>

              {lesson.materialCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-subtle">
                  <FileText aria-hidden className="size-3.5" />
                  <span className="tabular">
                    {lesson.materialCount} {detail.materialsSuffix}
                  </span>
                </span>
              )}

              {lesson.isPreview && <Badge tone="accent">{detail.previewBadge}</Badge>}

              <span className="tabular w-12 shrink-0 text-right text-xs text-muted">
                {formatClock(lesson.durationSec)}
              </span>
            </>
          );

          if (!lesson.isPreview) {
            return (
              <li key={lesson.id} className="flex items-center gap-3 px-5 py-3.5">
                {body}
              </li>
            );
          }

          const interactive =
            "flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors duration-150 " +
            "hover:bg-background focus-visible:outline-none focus-visible:ring-2 " +
            "focus-visible:ring-inset focus-visible:ring-primary";

          return (
            <li key={lesson.id}>
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={() => setPreviewing(lesson)}
                  aria-label={`${detail.previewOpen}: ${lesson.title}`}
                  className={interactive}
                >
                  {body}
                </button>
              ) : (
                // `next` brings them back to this course rather than to the
                // catalogue, so signing in does not lose their place.
                <Link
                  href={`/login?next=${encodeURIComponent(`/courses/${courseId}`)}`}
                  aria-label={`${detail.previewSignInPrompt}: ${lesson.title}`}
                  className={interactive}
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {previewing && (
        <PreviewDialog
          key={previewing.id}
          lessonId={previewing.id}
          lessonTitle={previewing.title}
          onClose={() => setPreviewing(null)}
        />
      )}
    </>
  );
}
