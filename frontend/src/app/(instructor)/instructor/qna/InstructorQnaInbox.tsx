"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Inbox, Search, ServerCrash, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { Pager } from "@/components/shared/Pager";
import { ApiError } from "@/lib/api-client";
import { formatCount, formatDateTime } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { qnaMessages } from "@/lib/messages/qna";
import { listPendingQna } from "@/lib/qna/api";
import type { PaginatedInstructorQna } from "@/lib/qna/types";

/**
 * Questions still waiting on this instructor, across every course they own.
 *
 * Oldest first, because the point of the screen is the queue, not the news.
 * Each row links into the course's own board, where answering happens — there
 * is no second reply box to keep in step with the first.
 */
export function InstructorQnaInbox() {
  const { inbox, meta } = qnaMessages;

  const [data, setData] = useState<PaginatedInstructorQna | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setData(await listPendingQna({ search, page }));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{inbox.title}</h1>
          <p className="mt-1 text-sm text-muted">{inbox.subtitle}</p>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchDraft.trim());
            setPage(1);
          }}
          className="flex items-center gap-2"
        >
          <Input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder={qnaMessages.board.searchPlaceholder}
            aria-label={qnaMessages.board.search}
            className="h-10 w-56"
          />
          <Button type="submit" variant="outline" size="sm" aria-label={qnaMessages.board.search}>
            <Search aria-hidden />
          </Button>
          {search !== "" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={qnaMessages.board.clearSearch}
              onClick={() => {
                setSearchDraft("");
                setSearch("");
                setPage(1);
              }}
            >
              <X aria-hidden />
            </Button>
          )}
        </form>
      </header>

      {loading ? (
        <div className="flex flex-col gap-3">
          <span className="sr-only">{inbox.loading}</span>
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 rounded-card" />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={inbox.errorTitle}
          body={error}
          action={
            <Button variant="outline" onClick={() => void load()}>
              {qnaMessages.board.retry}
            </Button>
          }
        />
      ) : data && data.items.length > 0 ? (
        <div className="overflow-hidden rounded-card border border-border bg-card">
          <p className="tabular border-b border-border px-5 py-3 text-sm text-muted">
            {inbox.pendingPrefix} {formatCount(data.total)} {inbox.pendingSuffix}
          </p>

          <ul className="divide-y divide-border">
            {data.items.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`/learn/${thread.course.id}/qna/${thread.id}`}
                  className="flex flex-col gap-2 px-5 py-4 transition-colors duration-150 hover:bg-background"
                >
                  <p className="text-xs text-subtle">
                    {inbox.courseLabel}: {thread.course.title}
                  </p>

                  <h2 className="text-base font-medium leading-snug text-foreground">
                    {thread.title}
                  </h2>

                  <p className="line-clamp-2 text-sm text-muted">{thread.body}</p>

                  <p className="tabular flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle">
                    <span>
                      {meta.askedBy} {thread.author.displayName}
                    </span>
                    <span>
                      {meta.askedAt} {formatDateTime(thread.createdAt)}
                    </span>
                    {thread.lesson && (
                      <span>
                        {meta.fromLesson}: {thread.lesson.title}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1 text-primary">
                      {inbox.open}
                      <ArrowRight aria-hidden className="size-3.5" />
                    </span>
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
          icon={Inbox}
          title={search === "" ? inbox.emptyTitle : inbox.emptyFilteredTitle}
          body={search === "" ? inbox.emptyBody : inbox.emptyFilteredBody}
        />
      )}
    </div>
  );
}
