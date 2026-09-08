"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, ClipboardList, RotateCcw, ServerCrash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { getMyQuizAttempts } from "@/lib/learn/api";
import type { QuizAttemptHistory, QuizReviewQuestion } from "@/lib/learn/types";
import { authMessages } from "@/lib/messages/auth";
import { learnMessages } from "@/lib/messages/learn";
import { cn } from "@/lib/utils";
import { ScoreDial } from "./ScoreDial";

/**
 * The marked paper.
 *
 * Reads the attempt history rather than carrying the submission's response
 * across the navigation, so the page is the same whether it was just reached by
 * pressing "ส่งคำตอบ" or opened again a week later.
 */
export function QuizResultView({ courseId, quizId }: { courseId: string; quizId: string }) {
  const { result: messages } = learnMessages;

  const [history, setHistory] = useState<QuizAttemptHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setHistory(await getMyQuizAttempts(quizId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <Shell>
        <span className="sr-only">{messages.loading}</span>
        <Skeleton className="h-64 rounded-card" />
      </Shell>
    );
  }

  if (!history) {
    return (
      <Shell>
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={messages.errorTitle}
          body={error ?? undefined}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {learnMessages.room.retry}
            </Button>
          }
        />
      </Shell>
    );
  }

  const latest = history.latestResult;

  if (!latest) {
    return (
      <Shell>
        <EmptyState
          icon={ClipboardList}
          title={messages.emptyTitle}
          body={messages.emptyBody}
          action={
            <Button asChild>
              <Link href={`/learn/${courseId}/quiz/${quizId}`}>
                {learnMessages.player.takeQuiz}
              </Link>
            </Button>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Link
        href={`/learn/${courseId}/${history.lessonId}`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {learnMessages.quiz.backToLesson}
      </Link>

      <section className="flex flex-col items-center gap-5 rounded-card border border-border bg-card px-5 py-8 sm:flex-row sm:items-center sm:gap-8 sm:px-8">
        <ScoreDial score={latest.score} passed={latest.passed} />

        <div className="flex min-w-0 flex-col gap-2 text-center sm:text-left">
          <h1 className="text-xl font-semibold text-foreground">{latest.quizTitle}</h1>

          <p
            className={cn(
              "flex w-fit items-center gap-1.5 self-center rounded-control border px-3 py-1.5 text-sm font-medium sm:self-start",
              latest.passed
                ? "border-success/30 bg-success/5 text-success"
                : "border-destructive/30 bg-destructive/5 text-destructive",
            )}
          >
            {latest.passed ? (
              <Check aria-hidden className="size-4" />
            ) : (
              <X aria-hidden className="size-4" />
            )}
            {latest.passed ? messages.passed : messages.failed}
          </p>

          <p className="tabular text-sm text-muted">
            {messages.correctPrefix} {latest.correctCount} {messages.correctMiddle}{" "}
            {latest.questionCount} {messages.correctSuffix} ·{" "}
            {learnMessages.quiz.passScorePrefix} {latest.passScore}
            {learnMessages.quiz.percentSuffix}
          </p>

          <p className="tabular text-xs text-subtle">{formatDateTime(latest.attemptedAt)}</p>

          <div className="mt-2 flex flex-wrap justify-center gap-2 sm:justify-start">
            <Button asChild>
              <Link href={`/learn/${courseId}/quiz/${quizId}`}>
                <RotateCcw aria-hidden />
                {messages.retake}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">{messages.answerKeyHeading}</h2>
        {latest.questions.map((question) => (
          <ReviewCard key={question.id} question={question} />
        ))}
      </section>

      {history.attempts.length > 1 && (
        <section className="rounded-card border border-border bg-card">
          <h2 className="border-b border-border px-5 py-4 text-base font-semibold text-foreground">
            {messages.history}
          </h2>

          <ul className="divide-y divide-border">
            {history.attempts.map((attempt) => (
              <li
                key={attempt.id}
                className="tabular flex items-center justify-between px-5 py-3 text-sm"
              >
                <span className="text-muted">
                  {messages.attemptPrefix} {attempt.attemptNo} ·{" "}
                  {formatDateTime(attempt.attemptedAt)}
                  {/* Silent while the bar has never moved; the moment it has,
                      two equal scores can be judged differently and the row
                      has to say why. */}
                  {attempt.passScore !== history.passScore && (
                    <span className="ml-1 text-subtle">
                      ({learnMessages.quiz.passScorePrefix} {attempt.passScore}
                      {learnMessages.quiz.percentSuffix})
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "font-medium",
                    attempt.passed ? "text-success" : "text-destructive",
                  )}
                >
                  {attempt.score} {messages.scoreSuffix}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Shell>
  );
}

/** One question, with what was ticked and what should have been. */
function ReviewCard({ question }: { question: QuizReviewQuestion }) {
  const { result: messages } = learnMessages;

  return (
    <article
      className={cn(
        "rounded-card border p-5",
        // A wrong answer is tinted, not shouted at: a thin border and a 5%
        // wash, the same treatment every destructive surface gets.
        question.isCorrect
          ? "border-border bg-card"
          : "border-destructive/30 bg-destructive/5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
            question.isCorrect ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
          )}
        >
          {question.isCorrect ? (
            <Check aria-hidden className="size-3.5" />
          ) : (
            <X aria-hidden className="size-3.5" />
          )}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <h3 className="text-sm font-medium leading-relaxed text-foreground">
            <span className="tabular text-muted">{question.orderIndex}. </span>
            {question.questionText}
          </h3>

          <ul className="flex flex-col gap-1.5">
            {question.choices.map((choice) => {
              const chosen = choice.id === question.selectedChoiceId;

              return (
                <li
                  key={choice.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-control border bg-card px-3 py-2 text-sm",
                    choice.isCorrect
                      ? "border-success/40 text-success"
                      : chosen
                        ? "border-destructive/40 text-destructive"
                        : "border-border text-muted",
                  )}
                >
                  <span>{choice.choiceText}</span>

                  <span className="shrink-0 text-xs">
                    {choice.isCorrect
                      ? messages.correctAnswer
                      : chosen
                        ? messages.yourAnswer
                        : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">{children}</div>
  );
}
