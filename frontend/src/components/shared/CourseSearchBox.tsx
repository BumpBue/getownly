"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ImageOff, Search } from "lucide-react";
import { listCourses } from "@/lib/catalog/api";
import type { CourseListItem } from "@/lib/catalog/types";
import { formatBahtShort, isFree } from "@/lib/format";
import { courseMessages } from "@/lib/messages/courses";
import { navMessages } from "@/lib/messages/nav";

const DEBOUNCE_MS = 300;
const PREVIEW_LIMIT = 5;
const MIN_QUERY_LENGTH = 2;

/**
 * The navbar's inline course search: type, get a short preview, pick one or
 * see everything.
 *
 * State is local and never touches the URL - unlike /courses's own filter
 * form, this box is not the page being searched, only a shortcut to it.
 */
export function CourseSearchBox({ className }: { className?: string }) {
  const { search: messages } = navMessages;
  const { card } = courseMessages;
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CourseListItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = window.setTimeout(() => {
      void listCourses(`search=${encodeURIComponent(trimmed)}&limit=${PREVIEW_LIMIT}`)
        .then((page) => setResults(page.items))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [query]);

  // Closes the preview when a click lands outside the box, the same pattern
  // window.confirm-based actions elsewhere in this app avoid needing at all -
  // this one genuinely needs it, since it has no backdrop of its own.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function goToFullSearch() {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return;
    }
    setOpen(false);
    router.push(`/courses?search=${encodeURIComponent(trimmed)}`);
  }

  const trimmed = query.trim();
  const showPreview = open && trimmed.length >= MIN_QUERY_LENGTH;

  return (
    <div ref={containerRef} className={className ?? "relative w-full max-w-md"}>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          goToFullSearch();
        }}
      >
        <div className="relative">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder={messages.placeholder}
            aria-label={messages.ariaLabel}
            className="h-10 w-full rounded-control border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-subtle focus:border-primary focus:outline-none"
          />
        </div>
      </form>

      {showPreview && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-card border border-border bg-card shadow-sm">
          {loading ? (
            <p className="px-4 py-4 text-center text-sm text-subtle">{messages.loading}</p>
          ) : results && results.length > 0 ? (
            <>
              <ul className="max-h-80 divide-y divide-border overflow-y-auto">
                {results.map((course) => (
                  <li key={course.id}>
                    <Link
                      href={`/courses/${course.id}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-150 hover:bg-background"
                    >
                      <div className="relative size-11 shrink-0 overflow-hidden rounded-control border border-border bg-background">
                        {course.coverUrl ? (
                          <Image src={course.coverUrl} alt="" fill sizes="44px" className="object-cover" />
                        ) : (
                          <div className="flex size-full items-center justify-center text-subtle">
                            <ImageOff aria-hidden className="size-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-foreground">
                          {course.title}
                        </p>
                        <p className="line-clamp-1 text-xs text-muted">
                          {course.instructor.displayName}
                        </p>
                      </div>
                      <span className="tabular shrink-0 text-sm font-semibold text-secondary">
                        {isFree(course.price) ? card.free : formatBahtShort(course.price)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={goToFullSearch}
                className="block w-full border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary transition-colors duration-150 hover:bg-background"
              >
                {messages.viewAllPrefix} &ldquo;{trimmed}&rdquo;
              </button>
            </>
          ) : results && results.length === 0 ? (
            <p className="px-4 py-4 text-center text-sm text-subtle">{messages.empty}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
