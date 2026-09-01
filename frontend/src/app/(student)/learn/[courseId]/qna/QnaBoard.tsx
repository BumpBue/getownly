"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  MessageCirclePlus,
  MessagesSquare,
  Search,
  ServerCrash,
  X,
} from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { QnaStatusBadge } from "@/components/shared/QnaStatusBadge";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { ApiError } from "@/lib/api-client";
import { formatCount, formatDateTime } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { qnaMessages } from "@/lib/messages/qna";
import { listCourseQna } from "@/lib/qna/api";
import { QNA_FILTERS, type PaginatedQnaThreads, type QnaFilter } from "@/lib/qna/types";
import { cn } from "@/lib/utils";
import { AskQuestionForm } from "./AskQuestionForm";

/**
 * The board: every question asked about one course.
 *
 * Filter and page live in React state rather than in the URL, which is the
 * opposite of the public catalog. The catalog's filters have to be shareable;
 * this board sits behind an enrolment, so a link to page three of it is of no
 * use to anyone who could not open it anyway.
 */
export function QnaBoard({
  courseId,
  fromLessonId,
}: {
  courseId: string;
  fromLessonId: string | null;
}) {
  const { board, meta } = qnaMessages;
  const router = useRouter();

  const [data, setData] = useState<PaginatedQnaThreads | null>(null);
  const [filter, setFilter] = useState<QnaFilter>("all");
  const [page, setPage] = useState(1);
  /** Committed on submit, so typing does not fire a request per keystroke. */
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [asking, setAsking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await listCourseQna(courseId, { filter, search, page }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [courseId, filter, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const apply = (next: { filter?: QnaFilter; search?: string }) => {
    if (next.filter !== undefined) {
      setFilter(next.filter);
    }
    if (next.search !== undefined) {
      setSearch(next.search);
    }
    // Page three of the old filter is not page three of the new one.
    setPage(1);
  };

  const isFiltered = filter !== "all" || search !== "";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2">
        {/* The classroom only exists for someone who bought the course. The
            instructor and an admin get the public course page instead, which
            is the one target that works for everybody. */}
        <Link
          href={data?.canAsk === false ? `/courses/${courseId}` : `/learn/${courseId}`}
          className="flex w-fit items-center gap-1.5 text-sm text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {data?.canAsk === false ? board.backToCourseDetail : board.backToCourse}
        </Link>

        <SectionHeading
          as="h1"
          title={board.title}
          subtitle={board.subtitle}
          action={
            data?.canAsk &&
            !asking && (
              <Button type="button" onClick={() => setAsking(true)}>
                <MessageCirclePlus aria-hidden />
                {board.ask}
              </Button>
            )
          }
        />
      </header>

      {/* Three audiences, three different notices: a student sees none, the
          instructor may answer but not ask, an admin may only look on. */}
      {data && !data.canAsk && (
        <Alert tone="info">{data.canReply ? board.instructorNotice : board.adminNotice}</Alert>
      )}

      {asking && (
        <AskQuestionForm
          courseId={courseId}
          defaultLessonId={fromLessonId}
          onCancel={() => setAsking(false)}
          // Straight into the new thread: the next thing anyone wants after
          // asking is to watch for the answer.
          onAsked={(thread) => router.push(`/learn/${courseId}/qna/${thread.id}`)}
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex flex-wrap gap-1">
          {QNA_FILTERS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              onClick={() => apply({ filter: id })}
              className={cn(
                "rounded-control border px-3 py-2 text-sm font-medium transition-colors duration-150",
                filter === id
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border bg-card text-muted hover:bg-background",
              )}
            >
              {board.filters[id]}
              {id === "unanswered" && data && data.unansweredTotal > 0 && (
                <span className="tabular ml-1.5 text-xs">({formatCount(data.unansweredTotal)})</span>
              )}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply({ search: searchDraft.trim() });
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={board.searchPlaceholder}
            aria-label={board.search}
            className="h-10 w-56"
          />
          <Button type="submit" variant="outline" size="sm" aria-label={board.search}>
            <Search aria-hidden />
          </Button>
          {search !== "" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={board.clearSearch}
              onClick={() => {
                setSearchDraft("");
                apply({ search: "" });
              }}
            >
              <X aria-hidden />
            </Button>
          )}
        </form>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          <span className="sr-only">{board.loading}</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-card" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={board.errorTitle}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {board.retry}
            </Button>
          }
        />
      ) : data && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <p className="tabular border-b border-border px-5 py-3 text-sm text-muted">
            {formatCount(data.total)} {board.threadCountSuffix}
          </p>

          <ul className="divide-y divide-border">
            {data.items.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/learn/${courseId}/qna/${thread.id}`}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors duration-150 hover:bg-background"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-base font-medium leading-snug text-foreground">
                      {thread.title}
                    </h2>
                    <QnaStatusBadge thread={thread} />
                  </div>

                  <p className="line-clamp-2 text-sm text-muted">{thread.body}</p>

                  <p className="tabular flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                    <span>
                      {meta.askedBy} {thread.author.displayName}
                    </span>
                    <span>
                      {meta.askedAt} {formatDateTime(thread.createdAt)}
                    </span>
                    <span>
                      {thread.replyCount === 0
                        ? meta.noReplies
                        : `${meta.replyCountPrefix} ${formatCount(thread.replyCount)} ${meta.replyCountSuffix}`}
                    </span>
                    {thread.lesson && (
                      <span>
                        {meta.fromLesson}: {thread.lesson.title}
                      </span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          <Pager
            page={data.page}
            totalPages={data.totalPages}
            disabled={loading}
            onChange={setPage}
          />
        </div>
      ) : (
        <EmptyState
          icon={MessagesSquare}
          title={isFiltered ? board.emptyFilteredTitle : board.emptyTitle}
          body={isFiltered ? board.emptyFilteredBody : board.emptyBody}
          action={
            data?.canAsk && !asking ? (
              <Button type="button" onClick={() => setAsking(true)}>
                {board.ask}
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}
