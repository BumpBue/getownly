"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ListChecks,
  ServerCrash,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { completeLesson, getLearnLesson, getLearnRoom } from "@/lib/learn/api";
import type { LearnLesson, LearnRoom, ProgressResult } from "@/lib/learn/types";
import { authMessages } from "@/lib/messages/auth";
import { learnMessages } from "@/lib/messages/learn";
import { LessonPlayer } from "./LessonPlayer";
import { LessonSidebar } from "./LessonSidebar";
import { LessonTabs } from "./LessonTabs";

/**
 * The lesson screen: video on the left, table of contents on the right.
 *
 * Both halves are loaded here and the progress that comes back from any save is
 * folded into both, so ticking a lesson off moves the bar in the sidebar
 * without a second round trip.
 */
export function LessonView({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const { room: roomMessages, player } = learnMessages;

  const [room, setRoom] = useState<LearnRoom | null>(null);
  const [lesson, setLesson] = useState<LearnLesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [nextRoom, nextLesson] = await Promise.all([
        getLearnRoom(courseId),
        getLearnLesson(courseId, lessonId),
      ]);
      setRoom(nextRoom);
      setLesson(nextLesson);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [courseId, lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** One update from the API, applied to the lesson and the sidebar at once. */
  const applyProgress = useCallback((result: ProgressResult) => {
    setLesson((current) =>
      current && current.id === result.progress.lessonId
        ? { ...current, progress: result.progress }
        : current,
    );

    setRoom((current) =>
      current
        ? {
            ...current,
            ...result.course,
            lessons: current.lessons.map((item) =>
              item.id === result.progress.lessonId
                ? {
                    ...item,
                    isCompleted: result.progress.isCompleted,
                    lastPositionSec: result.progress.lastPositionSec,
                  }
                : item,
            ),
          }
        : current,
    );
  }, []);

  const markComplete = async () => {
    if (!lesson) {
      return;
    }

    setMarking(true);
    try {
      applyProgress(await completeLesson(lesson.id));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <span className="sr-only">{roomMessages.loading}</span>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="aspect-video w-full rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      </Shell>
    );
  }

  if (error && !lesson) {
    return (
      <Shell>
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={roomMessages.errorTitle}
          body={error}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => void load()}>
                {roomMessages.retry}
              </Button>
              <Button asChild>
                <Link href="/my-courses">{roomMessages.backToMyCourses}</Link>
              </Button>
            </div>
          }
        />
      </Shell>
    );
  }

  if (!room || !lesson) {
    return null;
  }

  return (
    <Shell>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/my-courses"
            className="flex items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {roomMessages.backToMyCourses}
          </Link>
          <h1 className="mt-1 truncate text-lg font-semibold text-primary">{room.courseTitle}</h1>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <LessonPlayer lesson={lesson} onProgress={applyProgress} />

          <div>
            <p className="tabular text-sm text-muted">
              {player.lessonPrefix} {lesson.orderIndex}
            </p>
            <h2 className="mt-0.5 text-xl font-semibold text-foreground">{lesson.title}</h2>
          </div>

          {error && <Alert tone="error">{error}</Alert>}

          <div className="flex flex-wrap items-center gap-2">
            {lesson.progress.isCompleted ? (
              <span className="flex items-center gap-1.5 rounded-control border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
                <CheckCircle2 aria-hidden className="size-4" />
                {player.completed}
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={marking}
                onClick={() => void markComplete()}
              >
                <Check aria-hidden />
                {marking ? player.marking : player.markComplete}
              </Button>
            )}

            {lesson.quiz && (
              <Button asChild variant="secondary">
                <Link href={`/learn/${room.courseId}/quiz/${lesson.quiz.id}`}>
                  <ListChecks aria-hidden />
                  {player.takeQuiz}
                </Link>
              </Button>
            )}

            <div className="ml-auto flex items-center gap-2">
              {lesson.prevLessonId && (
                <Button asChild variant="ghost">
                  <Link href={`/learn/${room.courseId}/${lesson.prevLessonId}`}>
                    <ArrowLeft aria-hidden />
                    {player.prevLesson}
                  </Link>
                </Button>
              )}

              {lesson.nextLessonId ? (
                <Button asChild>
                  <Link href={`/learn/${room.courseId}/${lesson.nextLessonId}`}>
                    {player.nextLesson}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
              ) : (
                <Button asChild variant="outline">
                  <Link href="/my-courses">{player.finishCourse}</Link>
                </Button>
              )}
            </div>
          </div>

          <LessonTabs lesson={lesson} room={room} />
        </div>

        <LessonSidebar room={room} currentLessonId={lesson.id} />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      {children}
    </div>
  );
}
