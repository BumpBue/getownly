"use client";

import Link from "next/link";
import { CheckCircle2, Circle, ListChecks, PlayCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatClock } from "@/lib/format";
import type { LearnRoom } from "@/lib/learn/types";
import { learnMessages } from "@/lib/messages/learn";
import { cn } from "@/lib/utils";

/**
 * The table of contents, and how far through it the student is.
 *
 * Fixed at 320px on wide screens and stacked underneath the video on narrow
 * ones. The counts come from the API on every save, so ticking a lesson off
 * updates the bar without reloading the page.
 */
export function LessonSidebar({
  room,
  currentLessonId,
}: {
  room: LearnRoom;
  currentLessonId: string;
}) {
  const { sidebar } = learnMessages;

  return (
    <aside className="lg:sticky lg:top-20 lg:h-fit">
      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">{sidebar.heading}</h2>

          <Progress
            className="mt-3"
            value={room.progressPercent}
            label={`${sidebar.progressPrefix} ${room.completedLessonCount} ${sidebar.progressMiddle} ${room.lessonCount} ${sidebar.progressSuffix}`}
          />
        </div>

        <ol className="max-h-[32rem] divide-y divide-border overflow-y-auto">
          {room.lessons.map((lesson) => {
            const isCurrent = lesson.id === currentLessonId;

            return (
              <li key={lesson.id}>
                <Link
                  href={`/learn/${room.courseId}/${lesson.id}`}
                  aria-current={isCurrent ? "page" : undefined}
                  className={cn(
                    "flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-background",
                    isCurrent && "bg-background",
                  )}
                >
                  <span className="mt-0.5 shrink-0">
                    {lesson.isCompleted ? (
                      <CheckCircle2 aria-label={sidebar.completed} className="size-4 text-success" />
                    ) : isCurrent ? (
                      <PlayCircle aria-label={sidebar.current} className="size-4 text-primary" />
                    ) : (
                      <Circle aria-hidden className="size-4 text-subtle" />
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span
                      className={cn(
                        "line-clamp-2 text-sm leading-snug",
                        isCurrent ? "font-medium text-primary" : "text-foreground",
                      )}
                    >
                      {lesson.orderIndex}. {lesson.title}
                    </span>

                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                      <span className="tabular">{formatClock(lesson.durationSec)}</span>

                      {lesson.materialCount > 0 && (
                        <span className="tabular">
                          {lesson.materialCount} {sidebar.materialsSuffix}
                        </span>
                      )}

                      {lesson.quiz && (
                        <span
                          className={cn(
                            "flex items-center gap-1",
                            lesson.quiz.hasPassed && "text-success",
                          )}
                        >
                          <ListChecks aria-hidden className="size-3.5" />
                          {lesson.quiz.hasPassed ? sidebar.quizPassed : sidebar.hasQuiz}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
