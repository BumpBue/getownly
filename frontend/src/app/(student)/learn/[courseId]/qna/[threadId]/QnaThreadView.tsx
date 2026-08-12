"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CircleCheck,
  GraduationCap,
  RotateCcw,
  Send,
  ServerCrash,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/EmptyState";
import { QnaStatusBadge } from "@/components/shared/QnaStatusBadge";
import { ApiError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { qnaMessages } from "@/lib/messages/qna";
import {
  deleteQnaThread,
  getQnaThread,
  replyToThread,
  setThreadResolved,
} from "@/lib/qna/api";
import type { QnaReply, QnaThread } from "@/lib/qna/types";
import { cn } from "@/lib/utils";

/** One question and its answers, with the box to add another. */
export function QnaThreadView({ courseId, threadId }: { courseId: string; threadId: string }) {
  const { thread: messages, meta } = qnaMessages;
  const router = useRouter();

  const [thread, setThread] = useState<QnaThread | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"reply" | "resolve" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setThread(await getQnaThread(threadId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [threadId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Every mutation returns the whole thread, so the screen never guesses. */
  const run = async (action: "reply" | "resolve" | "delete", task: () => Promise<QnaThread>) => {
    setBusy(action);
    setError(null);

    try {
      setThread(await task());
      if (action === "reply") {
        setDraft("");
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!window.confirm(messages.removeConfirm)) {
      return;
    }

    setBusy("delete");
    setError(null);

    try {
      await deleteQnaThread(threadId);
      router.push(`/learn/${courseId}/qna`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <Shell>
        <span className="sr-only">{messages.loading}</span>
        <Skeleton className="h-64 rounded-card" />
      </Shell>
    );
  }

  if (!thread) {
    return (
      <Shell>
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={messages.errorTitle}
          body={error ?? undefined}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => void load()}>
                {qnaMessages.board.retry}
              </Button>
              <Button asChild>
                <Link href={`/learn/${courseId}/qna`}>{messages.backToBoard}</Link>
              </Button>
            </div>
          }
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Link
        href={`/learn/${courseId}/qna`}
        className="flex w-fit items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft aria-hidden className="size-4" />
        {messages.backToBoard}
      </Link>

      {error && <Alert tone="error">{error}</Alert>}

      <article className="rounded-card border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-semibold leading-snug text-foreground">{thread.title}</h1>
          <QnaStatusBadge thread={thread} />
        </div>

        <p className="tabular mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
          <span>
            {meta.askedBy} {thread.author.displayName}
          </span>
          <span>
            {meta.askedAt} {formatDateTime(thread.createdAt)}
          </span>
          {thread.lesson && (
            <Link
              href={`/learn/${courseId}/${thread.lesson.id}`}
              className="text-primary transition-colors duration-150 hover:underline"
            >
              {meta.fromLesson}: {thread.lesson.title}
            </Link>
          )}
        </p>

        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {thread.body}
        </p>

        {(thread.canResolve || thread.canDelete) && (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
            {thread.canResolve && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() =>
                  void run("resolve", () => setThreadResolved(threadId, !thread.isResolved))
                }
              >
                {thread.isResolved ? (
                  <RotateCcw aria-hidden />
                ) : (
                  <CircleCheck aria-hidden />
                )}
                {busy === "resolve"
                  ? messages.resolving
                  : thread.isResolved
                    ? messages.reopen
                    : messages.resolve}
              </Button>
            )}

            {thread.canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy !== null}
                onClick={() => void remove()}
                className="text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                <Trash2 aria-hidden />
                {busy === "delete" ? messages.removing : messages.remove}
              </Button>
            )}
          </div>
        )}
      </article>

      {thread.isResolved && <Alert tone="info">{messages.resolvedNotice}</Alert>}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-foreground">
          {messages.repliesHeading}
          {thread.replyCount > 0 && (
            <span className="tabular ml-1.5 text-sm font-normal text-muted">
              ({thread.replyCount})
            </span>
          )}
        </h2>

        {thread.replies.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title={messages.noRepliesTitle}
            body={thread.canReply ? messages.noRepliesBody : undefined}
          />
        ) : (
          thread.replies.map((reply) => (
            <ReplyCard key={reply.id} reply={reply} isAsker={reply.author.id === thread.author.id} />
          ))
        )}
      </section>

      {thread.canReply ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run("reply", () => replyToThread(threadId, draft.trim()));
          }}
          className="flex flex-col gap-3 rounded-card border border-border bg-card p-5"
        >
          <Label htmlFor="qna-reply">{messages.replyLabel}</Label>
          <Textarea
            id="qna-reply"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={messages.replyPlaceholder}
            rows={4}
            maxLength={5000}
            required
          />

          <Button type="submit" className="self-start" disabled={busy !== null}>
            <Send aria-hidden />
            {busy === "reply" ? messages.replying : messages.reply}
          </Button>
        </form>
      ) : (
        <Alert tone="info">{messages.replyClosedNotice}</Alert>
      )}
    </Shell>
  );
}

function ReplyCard({ reply, isAsker }: { reply: QnaReply; isAsker: boolean }) {
  const { badge } = qnaMessages;

  return (
    <article
      className={cn(
        "rounded-card border p-5",
        // The instructor's answer is the one people came for, so it is tinted
        // with `primary` — the palette's only blue (CLAUDE.md, หัวข้อ 4).
        reply.isInstructorReply ? "border-primary/30 bg-primary/5" : "border-border bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "text-sm font-medium",
            reply.isInstructorReply ? "text-primary" : "text-foreground",
          )}
        >
          {reply.author.displayName}
        </span>

        {reply.isInstructorReply && (
          <Badge tone="primary">
            <GraduationCap aria-hidden className="size-3.5" />
            {badge.instructor}
          </Badge>
        )}
        {isAsker && !reply.isInstructorReply && <Badge tone="neutral">{badge.asker}</Badge>}

        <span className="tabular ml-auto text-xs text-subtle">
          {formatDateTime(reply.createdAt)}
        </span>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
        {reply.body}
      </p>
    </article>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">{children}</div>
  );
}
