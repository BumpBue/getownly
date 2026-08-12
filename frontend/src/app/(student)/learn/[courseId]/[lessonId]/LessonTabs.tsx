"use client";

import Link from "next/link";
import { useState } from "react";
import { Download, FileText, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatDateTime, formatDuration, formatFileSize } from "@/lib/format";
import type { LearnLesson, LearnRoom } from "@/lib/learn/types";
import { learnMessages } from "@/lib/messages/learn";
import { cn } from "@/lib/utils";

type TabId = "details" | "materials" | "qna";

/**
 * Details, attachments and Q&A under the video.
 *
 * Plain buttons with `role="tab"` rather than a component library: the keyboard
 * and screen-reader behaviour that matters here is what the markup already
 * gives, and it saves a dependency (CLAUDE.md, ข้อห้าม 12).
 */
export function LessonTabs({ lesson, room }: { lesson: LearnLesson; room: LearnRoom }) {
  const { tabs, details, materials, qna } = learnMessages;
  const [active, setActive] = useState<TabId>("details");

  const items: { id: TabId; label: string; badge?: number }[] = [
    { id: "details", label: tabs.details },
    { id: "materials", label: tabs.materials, badge: lesson.materials.length },
    { id: "qna", label: tabs.qna },
  ];

  return (
    <div className="rounded-card border border-border bg-card">
      <div role="tablist" className="flex gap-1 border-b border-border px-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            onClick={() => setActive(item.id)}
            className={cn(
              "-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors duration-150",
              active === item.id
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-foreground",
            )}
          >
            {item.label}
            {item.badge ? <span className="tabular ml-1.5 text-xs">({item.badge})</span> : null}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="px-5 py-4">
        {active === "details" && (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row label={details.course} value={lesson.courseTitle} />
            <Row label={details.instructor} value={room.instructorName} />
            <Row
              label={details.duration}
              value={lesson.durationSec ? formatDuration(lesson.durationSec) : "—"}
            />
            <Row
              label={details.status}
              value={
                lesson.progress.isCompleted
                  ? `${details.completedAt} ${formatDateTime(lesson.progress.completedAt)}`
                  : details.notCompleted
              }
            />
            <p className="text-xs text-subtle sm:col-span-2">{details.autoCompleteNote}</p>
          </dl>
        )}

        {active === "materials" &&
          (lesson.materials.length === 0 ? (
            <EmptyState
              icon={FileText}
              title={materials.emptyTitle}
              body={materials.emptyBody}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {lesson.materials.map((material) => (
                <li
                  key={material.id}
                  className="flex items-center gap-3 rounded-control border border-border px-4 py-3"
                >
                  <FileText aria-hidden className="size-4 shrink-0 text-subtle" />

                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-foreground">{material.fileName}</span>
                    <span className="tabular text-xs text-subtle">
                      {formatFileSize(material.fileSize)}
                    </span>
                  </span>

                  {material.downloadUrl ? (
                    <a
                      href={material.downloadUrl}
                      className="flex shrink-0 items-center gap-1.5 rounded-control px-3 py-2 text-sm font-medium text-primary transition-colors duration-150 hover:bg-background"
                    >
                      <Download aria-hidden className="size-4" />
                      {materials.download}
                    </a>
                  ) : (
                    <span className="shrink-0 text-xs text-subtle">{materials.unavailable}</span>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {active === "qna" && (
          // The board itself lives on its own route: a question is about the
          // course, and the answer arrives long after this tab is closed. The
          // lesson travels in the URL so a question asked from here is filed
          // against the lesson the student was watching.
          <EmptyState
            icon={MessageCircleQuestion}
            title={qna.title}
            body={qna.body}
            action={
              <Button asChild>
                <Link href={`/learn/${lesson.courseId}/qna?lesson=${lesson.id}`}>
                  {qna.open}
                </Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}
