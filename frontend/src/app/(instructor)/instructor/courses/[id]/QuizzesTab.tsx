"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Lock, Pencil, Plus, ServerCrash, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { useToast } from "@/hooks/use-toast";
import { ApiError } from "@/lib/api-client";
import { deleteQuiz, getQuiz, listLessons } from "@/lib/catalog/api";
import type { Lesson, Quiz } from "@/lib/catalog/types";
import { formatCount } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { instructorMessages } from "@/lib/messages/instructor";
import { QuizForm } from "./QuizForm";

/**
 * ทก.01 A7: one quiz per lesson, authored by the instructor.
 *
 * The lesson list is the spine — a quiz has no existence apart from the lesson
 * it ends, so the tab lists lessons and shows what each one has, rather than
 * listing quizzes and making the reader work out where they belong.
 */
export function QuizzesTab({ courseId, readOnly }: { courseId: string; readOnly: boolean }) {
  const messages = instructorMessages.quizzes;
  const toast = useToast();

  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The lesson whose quiz is open in the form, if any. */
  const [editing, setEditing] = useState<{ lesson: Lesson; quiz: Quiz | null } | null>(null);
  const [busyLessonId, setBusyLessonId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLessons(await listLessons(courseId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openEditor(lesson: Lesson) {
    setBusyLessonId(lesson.id);
    try {
      // A new quiz opens on a blank draft; an existing one is fetched whole,
      // answer key included, because that is what the form edits.
      const quiz = lesson.quiz ? await getQuiz(lesson.quiz.id) : null;
      setEditing({ lesson, quiz });
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setBusyLessonId(null);
    }
  }

  async function remove(lesson: Lesson) {
    if (!lesson.quiz || !window.confirm(messages.removeConfirm)) {
      return;
    }

    setBusyLessonId(lesson.id);
    try {
      await deleteQuiz(lesson.quiz.id);
      toast.success(messages.removed);
      await load();
    } catch (caught) {
      toast.error(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setBusyLessonId(null);
    }
  }

  if (error !== null) {
    return (
      <EmptyState
        icon={ServerCrash}
        tone="destructive"
        title={authMessages.errors.unexpected}
        body={error}
        action={
          <Button variant="outline" onClick={() => void load()}>
            {instructorMessages.students.retry}
          </Button>
        }
      />
    );
  }

  if (lessons === null) {
    return <Skeleton className="h-64 rounded-card" />;
  }

  if (lessons.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={messages.noLessons}
        body={messages.noLessonsBody}
      />
    );
  }

  if (editing !== null) {
    return (
      <section className="rounded-card border border-border bg-card p-5">
        <p className="mb-4 text-xs text-subtle">
          {messages.lessonPrefix} {editing.lesson.orderIndex} · {editing.lesson.title}
        </p>
        <QuizForm
          lessonId={editing.lesson.id}
          quiz={editing.quiz}
          attemptCount={editing.lesson.quiz?.attemptCount ?? 0}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{messages.heading}</h2>
        <p className="mt-0.5 text-xs text-subtle">{messages.subtitle}</p>
      </div>

      <ul className="divide-y divide-border">
        {lessons.map((lesson) => {
          const quiz = lesson.quiz;
          const locked = (quiz?.attemptCount ?? 0) > 0;
          const busy = busyLessonId === lesson.id;

          return (
            <li
              key={lesson.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="text-xs text-subtle">
                  {messages.lessonPrefix} {lesson.orderIndex}
                </p>
                <p className="truncate text-sm font-medium text-foreground">{lesson.title}</p>

                {quiz ? (
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                    <span className="truncate text-foreground">{quiz.title}</span>
                    <span className="tabular">
                      {messages.questionCount} {formatCount(quiz.questionCount)}{" "}
                      {messages.questionUnit}
                    </span>
                    <span className="tabular">
                      {messages.passScoreLabel} {quiz.passScore}%
                    </span>
                    {locked && (
                      <Badge tone="pending">
                        <Lock aria-hidden className="size-3" />
                        {messages.attemptCount} {formatCount(quiz.attemptCount)}{" "}
                        {messages.attemptUnit}
                      </Badge>
                    )}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-subtle">{messages.noQuizYet}</p>
                )}
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  variant={quiz ? "outline" : "primary"}
                  size="sm"
                  disabled={readOnly || busy}
                  onClick={() => void openEditor(lesson)}
                >
                  {quiz ? (
                    <>
                      <Pencil aria-hidden className="size-4" />
                      {messages.edit}
                    </>
                  ) : (
                    <>
                      <Plus aria-hidden className="size-4" />
                      {messages.create}
                    </>
                  )}
                </Button>

                {quiz && (
                  <Button
                    variant="ghost"
                    size="sm"
                    // Deleting takes the recorded scores with it, so a sat quiz
                    // stays — and the tooltip says why rather than going quiet.
                    disabled={readOnly || locked || busy}
                    title={
                      locked
                        ? messages.lockedDeleteTooltip.replace(
                            "{count}",
                            String(quiz.attemptCount),
                          )
                        : messages.remove
                    }
                    onClick={() => void remove(lesson)}
                  >
                    <Trash2 aria-hidden className="size-4 text-destructive" />
                    <span className="sr-only">{messages.remove}</span>
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
