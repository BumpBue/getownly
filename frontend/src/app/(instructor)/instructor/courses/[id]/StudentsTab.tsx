"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronDown, ServerCrash, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { getCourseStudents } from "@/lib/catalog/api";
import type { CourseStudent, CourseStudentQuiz, PaginatedCourseStudents } from "@/lib/catalog/types";
import { formatCount, formatDate } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { instructorMessages } from "@/lib/messages/instructor";
import { cn } from "@/lib/utils";

/**
 * ทก.01 A9: who is enrolled, how far they have got, and how they did.
 *
 * The percentage shown here is not computed in this file. It arrives from the
 * API, which builds it with the same function the student's own classroom
 * uses (backend/src/common/progress.ts), so the two screens cannot disagree.
 *
 * Per-quiz scores travel with each row rather than behind a second request:
 * the whole page is one query batch already, and expanding a row that then
 * has to wait on the network feels broken for information that small.
 */
export function StudentsTab({ courseId }: { courseId: string }) {
  const messages = instructorMessages.students;

  const [data, setData] = useState<PaginatedCourseStudents | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await getCourseStudents(courseId, page));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [courseId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error !== null) {
    return (
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
    );
  }

  if (loading) {
    return <Skeleton className="h-64 rounded-card" />;
  }

  if (data === null || data.items.length === 0) {
    return <EmptyState icon={Users} title={messages.empty} body={messages.emptyBody} />;
  }

  return (
    <section className="overflow-hidden rounded-card border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-base font-semibold text-foreground">{messages.heading}</h2>
        <p className="mt-0.5 text-xs text-subtle">{messages.subtitle}</p>
      </div>

      {/* Phones: one card per student, because five columns plus an expandable
          score list cannot be read at 375px. */}
      <ul className="divide-y divide-border md:hidden">
        {data.items.map((student) => (
          <li key={student.enrollmentId} className="px-5 py-4">
            <StudentCard
              student={student}
              expanded={expanded === student.enrollmentId}
              onToggle={() =>
                setExpanded((current) =>
                  current === student.enrollmentId ? null : student.enrollmentId,
                )
              }
            />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-border text-left text-xs text-muted">
            <tr>
              <th className="px-5 py-2.5 font-medium">{messages.columnName}</th>
              <th className="px-5 py-2.5 font-medium">{messages.columnEnrolledAt}</th>
              <th className="px-5 py-2.5 text-right font-medium">{messages.columnLessons}</th>
              <th className="px-5 py-2.5 font-medium">{messages.columnProgress}</th>
              <th className="px-5 py-2.5 text-right font-medium">{messages.columnQuizzes}</th>
              <th className="w-10 px-5 py-2.5" />
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {data.items.map((student) => {
              const isOpen = expanded === student.enrollmentId;

              return (
                <Fragment key={student.enrollmentId}>
                  <tr
                    className="cursor-pointer transition-colors duration-150 hover:bg-background"
                    onClick={() => setExpanded(isOpen ? null : student.enrollmentId)}
                  >
                    <td className="px-5 py-3 font-medium text-foreground">
                      {student.displayName}
                    </td>
                    <td className="px-5 py-3 text-muted">{formatDate(student.enrolledAt)}</td>
                    <td className="tabular px-5 py-3 text-right text-muted">
                      {formatCount(student.completedLessonCount)} / {formatCount(student.lessonCount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Progress value={student.progressPercent} tone="secondary" className="w-24" />
                        <span className="tabular text-xs text-muted">
                          {student.progressPercent}%
                        </span>
                      </div>
                    </td>
                    <td className="tabular px-5 py-3 text-right text-muted">
                      {formatCount(student.passedQuizCount)} / {formatCount(student.quizCount)}{" "}
                      {messages.quizUnit}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-label={isOpen ? messages.collapse : messages.expand}
                        className="text-subtle transition-colors duration-150 hover:text-foreground"
                        onClick={(event) => {
                          event.stopPropagation();
                          setExpanded(isOpen ? null : student.enrollmentId);
                        }}
                      >
                        <ChevronDown
                          aria-hidden
                          className={cn(
                            "size-4 transition-transform duration-150",
                            isOpen && "rotate-180",
                          )}
                        />
                      </button>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-background">
                      <td colSpan={6} className="px-5 py-4">
                        <QuizBreakdown quizzes={student.quizzes} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          {messages.countStatus.replace("{total}", formatCount(data.total))}
          {" · "}
          {messages.pageStatus
            .replace("{page}", formatCount(data.page))
            .replace("{totalPages}", formatCount(data.totalPages))}
        </p>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={data.page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {messages.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={data.page >= data.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            {messages.next}
          </Button>
        </div>
      </div>
    </section>
  );
}

function StudentCard({
  student,
  expanded,
  onToggle,
}: {
  student: CourseStudent;
  expanded: boolean;
  onToggle: () => void;
}) {
  const messages = instructorMessages.students;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">{student.displayName}</p>
          <p className="text-xs text-subtle">{formatDate(student.enrolledAt)}</p>
        </div>
        <span className="tabular text-sm font-semibold text-foreground">
          {student.progressPercent}%
        </span>
      </div>

      <Progress value={student.progressPercent} tone="secondary" />

      <dl className="grid grid-cols-2 gap-x-4 text-xs">
        <div>
          <dt className="text-subtle">{messages.columnLessons}</dt>
          <dd className="tabular text-sm text-muted">
            {formatCount(student.completedLessonCount)} / {formatCount(student.lessonCount)}{" "}
            {messages.lessonsUnit}
          </dd>
        </div>
        <div>
          <dt className="text-subtle">{messages.columnQuizzes}</dt>
          <dd className="tabular text-sm text-muted">
            {formatCount(student.passedQuizCount)} / {formatCount(student.quizCount)}{" "}
            {messages.quizUnit}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex items-center gap-1 self-start text-xs font-medium text-primary transition-colors duration-150 hover:text-foreground"
      >
        {expanded ? messages.collapse : messages.expand}
        <ChevronDown
          aria-hidden
          className={cn("size-3.5 transition-transform duration-150", expanded && "rotate-180")}
        />
      </button>

      {expanded && <QuizBreakdown quizzes={student.quizzes} />}
    </div>
  );
}

/** Every quiz in the course, including the ones this student never opened. */
function QuizBreakdown({ quizzes }: { quizzes: CourseStudentQuiz[] }) {
  const messages = instructorMessages.students;

  if (quizzes.length === 0) {
    return <p className="text-xs text-subtle">{messages.noQuizzes}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {quizzes.map((quiz) => (
        <li
          key={quiz.quizId}
          className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border bg-card px-3 py-2"
        >
          <div className="min-w-0">
            <p className="truncate text-sm text-foreground">{quiz.quizTitle}</p>
            <p className="truncate text-xs text-subtle">
              {quiz.lessonTitle} · {messages.quizPassScore} {quiz.passScore}%
              {quiz.attemptCount > 0 && (
                <>
                  {" · "}
                  {messages.quizAttempts} {formatCount(quiz.attemptCount)}{" "}
                  {messages.quizAttemptsUnit}
                </>
              )}
            </p>
          </div>

          {/* Never sat is not a score of zero, so it does not get printed as one. */}
          {quiz.bestScore === null ? (
            <Badge tone="neutral">{messages.quizNotAttempted}</Badge>
          ) : (
            <div className="flex items-center gap-2">
              <span className="tabular text-sm font-medium text-foreground">
                {quiz.bestScore}%
              </span>
              <Badge tone={quiz.hasPassed ? "success" : "destructive"}>
                {quiz.hasPassed ? messages.quizPassed : messages.quizFailed}
              </Badge>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
