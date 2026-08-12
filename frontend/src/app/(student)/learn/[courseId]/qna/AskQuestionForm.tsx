"use client";

import { useEffect, useState } from "react";
import { MessageCirclePlus } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import { getLearnRoom } from "@/lib/learn/api";
import type { LearnLessonSummary } from "@/lib/learn/types";
import { authMessages } from "@/lib/messages/auth";
import { qnaMessages } from "@/lib/messages/qna";
import { askQuestion } from "@/lib/qna/api";
import type { QnaThread } from "@/lib/qna/types";

/**
 * The "ask a question" form.
 *
 * The lesson list is fetched here rather than passed in, because the board is
 * reachable without ever opening a lesson. When the board was opened *from* a
 * lesson, that lesson is preselected — the common case is asking about the
 * thing you were just watching.
 */
export function AskQuestionForm({
  courseId,
  defaultLessonId,
  onAsked,
  onCancel,
}: {
  courseId: string;
  defaultLessonId: string | null;
  onAsked: (thread: QnaThread) => void;
  onCancel: () => void;
}) {
  const { ask } = qnaMessages;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [lessonId, setLessonId] = useState(defaultLessonId ?? "");
  const [lessons, setLessons] = useState<LearnLessonSummary[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getLearnRoom(courseId)
      .then((room) => {
        if (!cancelled) {
          setLessons(room.lessons);
        }
      })
      .catch(() => {
        // The lesson picker is optional; without it the question is simply
        // filed against the course.
      });

    return () => {
      cancelled = true;
    };
  }, [courseId]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      onAsked(
        await askQuestion(courseId, {
          title: title.trim(),
          body: body.trim(),
          ...(lessonId ? { lessonId } : {}),
        }),
      );
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-4 rounded-card border border-border bg-card p-5"
    >
      <div>
        <h2 className="text-base font-semibold text-foreground">{ask.title}</h2>
        <p className="mt-1 text-sm text-muted">{ask.subtitle}</p>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qna-title">{ask.titleLabel}</Label>
        <Input
          id="qna-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={ask.titlePlaceholder}
          maxLength={150}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="qna-body">{ask.bodyLabel}</Label>
        <Textarea
          id="qna-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={ask.bodyPlaceholder}
          rows={6}
          maxLength={5000}
          required
        />
      </div>

      {lessons.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qna-lesson">{ask.lessonLabel}</Label>
          <Select
            id="qna-lesson"
            value={lessonId}
            onChange={(event) => setLessonId(event.target.value)}
          >
            <option value="">{ask.lessonNone}</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.orderIndex}. {lesson.title}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>
          <MessageCirclePlus aria-hidden />
          {submitting ? ask.submitting : ask.submit}
        </Button>
        <Button type="button" variant="ghost" disabled={submitting} onClick={onCancel}>
          {ask.cancel}
        </Button>
      </div>
    </form>
  );
}
