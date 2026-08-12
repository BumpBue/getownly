"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Send, ServerCrash } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { getQuizPaper, submitQuiz } from "@/lib/learn/api";
import type { QuizTake } from "@/lib/learn/types";
import { authMessages } from "@/lib/messages/auth";
import { learnMessages } from "@/lib/messages/learn";
import { cn } from "@/lib/utils";

/**
 * Sitting a quiz: one question on screen at a time, with a strip of numbers to
 * jump around.
 *
 * Nothing here knows which answer is right. The paper arrives without the key
 * and the score comes back from the API, so the only thing this screen decides
 * is what gets sent (PLAN.md, เฟส 6).
 */
export function QuizView({ courseId, quizId }: { courseId: string; quizId: string }) {
  const { quiz: messages } = learnMessages;
  const router = useRouter();

  const [paper, setPaper] = useState<QuizTake | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setPaper(await getQuizPaper(quizId));
      setAnswers({});
      setIndex(0);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [quizId]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    if (!paper) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitQuiz(
        quizId,
        paper.questions.map((question) => ({
          questionId: question.id,
          choiceId: answers[question.id] as string,
        })),
      );
      router.push(`/learn/${courseId}/quiz/${quizId}/result`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Shell>
        <span className="sr-only">{messages.loading}</span>
        <Skeleton className="h-80 rounded-card" />
      </Shell>
    );
  }

  if (!paper) {
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

  const question = paper.questions[index];
  const unanswered = paper.questions.filter((item) => !answers[item.id]).length;

  return (
    <Shell>
      <header className="flex flex-col gap-2">
        <Link
          href={`/learn/${courseId}/${paper.lessonId}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {messages.backToLesson}
        </Link>

        <h1 className="text-xl font-semibold text-primary">{paper.title}</h1>

        <p className="tabular flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>
            {messages.passScorePrefix} {paper.passScore}
            {messages.percentSuffix}
          </span>
          {paper.attemptCount > 0 && (
            <span>
              {messages.attemptCountPrefix} {paper.attemptCount} {messages.attemptCountSuffix}
            </span>
          )}
          {paper.bestScore !== null && (
            <span>
              {messages.bestScorePrefix} {paper.bestScore}
              {messages.percentSuffix}
            </span>
          )}
        </p>
      </header>

      {error && <Alert tone="error">{error}</Alert>}

      {question && (
        <div className="rounded-card border border-border bg-card p-5">
          <p className="tabular text-sm text-muted">
            {messages.questionPrefix} {index + 1} {messages.questionMiddle} {paper.questionCount}
          </p>

          <h2 className="mt-2 text-lg font-medium leading-relaxed text-foreground">
            {question.questionText}
          </h2>

          <div className="mt-5 flex flex-col gap-2">
            {question.choices.map((choice) => {
              const selected = answers[question.id] === choice.id;

              return (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() =>
                    setAnswers((current) => ({ ...current, [question.id]: choice.id }))
                  }
                  className={cn(
                    "flex items-center gap-3 rounded-control border px-4 py-3 text-left text-sm transition-colors duration-150",
                    selected
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-card text-foreground hover:bg-background",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-primary" : "border-subtle",
                    )}
                  >
                    {selected && <span className="size-2.5 rounded-full bg-primary" />}
                  </span>
                  <span>{choice.choiceText}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* The number strip: where you are, what is answered, and a way to any of it. */}
      <nav aria-label={messages.jumpLabel} className="flex flex-wrap gap-2">
        {paper.questions.map((item, position) => {
          const answered = Boolean(answers[item.id]);

          return (
            <button
              key={item.id}
              type="button"
              aria-label={`${messages.jumpLabel} ${position + 1}`}
              aria-current={position === index ? "step" : undefined}
              onClick={() => setIndex(position)}
              className={cn(
                "tabular size-9 rounded-control border text-sm font-medium transition-colors duration-150",
                answered
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted hover:bg-background",
                position === index && "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
            >
              {position + 1}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={index === 0}
          onClick={() => setIndex((current) => current - 1)}
        >
          <ArrowLeft aria-hidden />
          {messages.prev}
        </Button>

        {index < paper.questions.length - 1 && (
          <Button type="button" variant="outline" onClick={() => setIndex((current) => current + 1)}>
            {messages.next}
            <ArrowRight aria-hidden />
          </Button>
        )}

        <div className="ml-auto flex items-center gap-3">
          <p className="tabular text-sm text-muted">
            {unanswered === 0
              ? messages.answeredAll
              : `${messages.unansweredCountPrefix} ${unanswered} ${messages.unansweredCountSuffix}`}
          </p>

          <Button
            type="button"
            disabled={unanswered > 0 || submitting}
            onClick={() => void send()}
          >
            <Send aria-hidden />
            {submitting ? messages.submitting : messages.submit}
          </Button>
        </div>
      </div>

      <p className="text-center text-xs text-subtle">{messages.unlimitedNote}</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">{children}</div>
  );
}
