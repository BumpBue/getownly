"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Layers, Plus, ServerCrash } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { createLesson, listLessons, reorderLessons } from "@/lib/catalog/api";
import { lessonTitleSchema } from "@/lib/catalog/schemas";
import type { Lesson } from "@/lib/catalog/types";
import { authMessages } from "@/lib/messages/auth";
import { instructorMessages } from "@/lib/messages/instructor";
import { LessonRow } from "./LessonRow";

/**
 * The curriculum editor.
 *
 * Reordering is applied optimistically and rolled back if the API rejects it,
 * because a list that snaps back after a drag is the one thing worse than a
 * list that does not move at all. The server re-numbers `orderIndex` and
 * returns the authoritative list, which replaces the optimistic one.
 */
export function CurriculumTab({ courseId, readOnly }: { courseId: string; readOnly: boolean }) {
  const { curriculum } = instructorMessages;

  const [lessons, setLessons] = useState<Lesson[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const sensors = useSensors(
    // A small distance keeps a click on the handle from being read as a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = useCallback(async () => {
    setError(null);
    try {
      setLessons(await listLessons(courseId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    }
  }, [courseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onDragEnd(event: DragEndEvent): Promise<void> {
    const { active, over } = event;
    if (!over || active.id === over.id || !lessons) {
      return;
    }

    const from = lessons.findIndex((lesson) => lesson.id === active.id);
    const to = lessons.findIndex((lesson) => lesson.id === over.id);
    if (from === -1 || to === -1) {
      return;
    }

    const previous = lessons;
    const optimistic = arrayMove(lessons, from, to).map((lesson, index) => ({
      ...lesson,
      orderIndex: index + 1,
    }));
    setLessons(optimistic);
    setError(null);

    try {
      setLessons(await reorderLessons(courseId, optimistic.map((lesson) => lesson.id)));
    } catch {
      setLessons(previous);
      setError(curriculum.reorderFailed);
    }
  }

  async function onAdd(): Promise<void> {
    const parsed = lessonTitleSchema.safeParse(newTitle.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? null);
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const created = await createLesson(courseId, { title: parsed.data });
      setLessons((current) => [...(current ?? []), created]);
      setNewTitle("");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    } finally {
      setAdding(false);
    }
  }

  function replaceLesson(updated: Lesson): void {
    setLessons(
      (current) =>
        current?.map((lesson) => (lesson.id === updated.id ? { ...lesson, ...updated } : lesson)) ??
        null,
    );
  }

  /** Renumbers locally so the visible order matches what the server just did. */
  function dropLesson(lessonId: string): void {
    setLessons(
      (current) =>
        current
          ?.filter((lesson) => lesson.id !== lessonId)
          .map((lesson, index) => ({ ...lesson, orderIndex: index + 1 })) ?? null,
    );
  }

  if (lessons === null) {
    return error ? (
      <EmptyState
        icon={ServerCrash}
        tone="destructive"
        title={instructorMessages.editor.errorTitle}
        body={error}
      />
    ) : (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-40 rounded-card" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>{curriculum.heading}</CardTitle>
          <span className="text-xs text-subtle">{curriculum.hint}</span>
        </CardHeader>

        {error && (
          <div className="px-5 pt-4">
            <Alert tone="error">{error}</Alert>
          </div>
        )}

        {lessons.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={Layers}
              title={curriculum.emptyTitle}
              body={curriculum.emptyBody}
            />
          </CardBody>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis, restrictToParentElement]}
            onDragEnd={(event) => void onDragEnd(event)}
          >
            <SortableContext
              items={lessons.map((lesson) => lesson.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul>
                {lessons.map((lesson) => (
                  <LessonRow
                    key={lesson.id}
                    lesson={lesson}
                    readOnly={readOnly}
                    onChanged={replaceLesson}
                    onRemoved={dropLesson}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <label htmlFor="new-lesson" className="text-sm font-medium text-foreground">
              {curriculum.newLessonTitle}
            </label>
            <Input
              id="new-lesson"
              value={newTitle}
              disabled={readOnly || adding}
              onChange={(event) => setNewTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void onAdd();
                }
              }}
              placeholder={curriculum.newLessonPlaceholder}
            />
          </div>

          <Button type="button" disabled={readOnly || adding} onClick={() => void onAdd()}>
            <Plus aria-hidden />
            {adding ? curriculum.addingLesson : curriculum.addLesson}
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
