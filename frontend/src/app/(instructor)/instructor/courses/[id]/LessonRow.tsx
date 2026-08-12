"use client";

import { useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  Download,
  FileText,
  GripVertical,
  Paperclip,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ApiError } from "@/lib/api-client";
import {
  createMaterial,
  deleteLesson,
  deleteMaterial,
  getSignedUrl,
  updateLesson,
} from "@/lib/catalog/api";
import { UPLOAD_ACCEPT, type Lesson } from "@/lib/catalog/types";
import { UploadError, uploadFile } from "@/lib/catalog/upload";
import { formatFileSize } from "@/lib/format";
import { authMessages } from "@/lib/messages/auth";
import { instructorMessages } from "@/lib/messages/instructor";

/**
 * One row of the curriculum: a drag handle, the title, the video slot and the
 * attachment list.
 *
 * Every mutation reports the row it changed back up to the parent, which owns
 * the list. Keeping the list in one place is what makes the optimistic
 * reordering safe to roll back.
 */
export function LessonRow({
  lesson,
  readOnly,
  onChanged,
  onRemoved,
}: {
  lesson: Lesson;
  readOnly: boolean;
  onChanged: (lesson: Lesson) => void;
  onRemoved: (lessonId: string) => void;
}) {
  const { curriculum } = instructorMessages;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lesson.id,
    disabled: readOnly,
  });

  const [title, setTitle] = useState(lesson.title);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<number | null>(null);
  const [materialProgress, setMaterialProgress] = useState<number | null>(null);

  const videoInput = useRef<HTMLInputElement>(null);
  const materialInput = useRef<HTMLInputElement>(null);

  function reportError(caught: unknown): void {
    if (caught instanceof UploadError || caught instanceof ApiError) {
      setError(caught.message);
    } else {
      setError(authMessages.errors.unexpected);
    }
  }

  async function saveTitle(): Promise<void> {
    const trimmed = title.trim();
    if (trimmed === lesson.title || trimmed.length < 3) {
      setTitle(lesson.title);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      onChanged(await updateLesson(lesson.id, { title: trimmed }));
    } catch (caught) {
      setTitle(lesson.title);
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function togglePreview(isPreview: boolean): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      onChanged(await updateLesson(lesson.id, { isPreview }));
    } catch (caught) {
      reportError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function onVideoPicked(file: File): Promise<void> {
    setError(null);
    setVideoProgress(0);
    try {
      const uploaded = await uploadFile("video", file, setVideoProgress).promise;
      onChanged(await updateLesson(lesson.id, { videoKey: uploaded.fileKey }));
    } catch (caught) {
      reportError(caught);
    } finally {
      setVideoProgress(null);
      if (videoInput.current) videoInput.current.value = "";
    }
  }

  async function onMaterialPicked(file: File): Promise<void> {
    setError(null);
    setMaterialProgress(0);
    try {
      const uploaded = await uploadFile("material", file, setMaterialProgress).promise;
      const material = await createMaterial(lesson.id, uploaded);
      onChanged({ ...lesson, materials: [...lesson.materials, material] });
    } catch (caught) {
      reportError(caught);
    } finally {
      setMaterialProgress(null);
      if (materialInput.current) materialInput.current.value = "";
    }
  }

  async function onMaterialRemoved(materialId: string): Promise<void> {
    setError(null);
    try {
      await deleteMaterial(materialId);
      onChanged({
        ...lesson,
        materials: lesson.materials.filter((material) => material.id !== materialId),
      });
    } catch (caught) {
      reportError(caught);
    }
  }

  /** Attachments open through a signed URL minted at click time, never stored. */
  async function openMaterial(fileKey: string): Promise<void> {
    setError(null);
    try {
      const { url } = await getSignedUrl(fileKey);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (caught) {
      reportError(caught);
    }
  }

  async function onRemove(): Promise<void> {
    if (!window.confirm(curriculum.removeLessonConfirm)) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await deleteLesson(lesson.id);
      onRemoved(lesson.id);
    } catch (caught) {
      reportError(caught);
      setBusy(false);
    }
  }

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-border last:border-b-0 ${isDragging ? "relative z-10 bg-background" : "bg-card"}`}
    >
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            aria-label={curriculum.hint}
            disabled={readOnly}
            className="mt-2 cursor-grab touch-none rounded-control p-1 text-subtle transition-colors duration-150 hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden className="size-4" />
          </button>

          <span className="tabular mt-2.5 w-14 shrink-0 text-xs text-subtle">
            {curriculum.lessonPrefix} {lesson.orderIndex}
          </span>

          <div className="flex flex-1 flex-col gap-2">
            <Input
              value={title}
              disabled={readOnly || busy}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => void saveTitle()}
              placeholder={curriculum.newLessonPlaceholder}
            />

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={lesson.isPreview}
                  disabled={readOnly || busy}
                  onChange={(event) => void togglePreview(event.target.checked)}
                  className="size-3.5 rounded-sm border-border accent-primary"
                />
                {curriculum.preview}
              </label>

              {lesson.hasVideo ? (
                <Badge tone="success">
                  <Check aria-hidden className="size-3" />
                  {curriculum.hasVideo}
                </Badge>
              ) : (
                <Badge tone="neutral">
                  <Video aria-hidden className="size-3" />
                  {curriculum.noVideo}
                </Badge>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={curriculum.removeLesson}
            disabled={readOnly || busy}
            onClick={() => void onRemove()}
            className="mt-1 text-muted hover:text-destructive"
          >
            <Trash2 aria-hidden />
          </Button>
        </div>

        <div className="ml-[4.75rem] flex flex-col gap-3">
          {error && <p className="text-xs text-destructive">{error}</p>}

          {/* --- video ---------------------------------------------------- */}
          {videoProgress !== null ? (
            <Progress value={videoProgress} label={curriculum.uploadingVideo} />
          ) : (
            <>
              <input
                ref={videoInput}
                type="file"
                accept={UPLOAD_ACCEPT.video.join(",")}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onVideoPicked(file);
                }}
              />
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => videoInput.current?.click()}
                >
                  <Upload aria-hidden />
                  {lesson.hasVideo ? curriculum.replaceVideo : curriculum.uploadVideo}
                </Button>
              </div>
            </>
          )}

          {/* --- attachments ---------------------------------------------- */}
          <div className="rounded-control border border-border bg-background p-3">
            <p className="mb-2 text-xs font-medium text-foreground">{curriculum.materials}</p>

            {lesson.materials.length === 0 ? (
              <p className="text-xs text-subtle">{curriculum.noMaterials}</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {lesson.materials.map((material) => (
                  <li key={material.id} className="flex items-center gap-2 text-xs">
                    <FileText aria-hidden className="size-3.5 shrink-0 text-subtle" />
                    <button
                      type="button"
                      onClick={() => void openMaterial(material.fileKey)}
                      className="flex-1 truncate text-left text-foreground transition-colors duration-150 hover:text-primary"
                    >
                      {material.fileName}
                    </button>
                    <span className="tabular shrink-0 text-subtle">
                      {formatFileSize(material.fileSize)}
                    </span>
                    <Download aria-hidden className="size-3.5 shrink-0 text-subtle" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={curriculum.removeMaterial}
                      disabled={readOnly}
                      onClick={() => void onMaterialRemoved(material.id)}
                      className="h-7 px-2 text-muted hover:text-destructive"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {materialProgress !== null ? (
              <Progress
                value={materialProgress}
                label={curriculum.uploadingMaterial}
                className="mt-3"
              />
            ) : (
              <>
                <input
                  ref={materialInput}
                  type="file"
                  accept={UPLOAD_ACCEPT.material.join(",")}
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onMaterialPicked(file);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={readOnly}
                  onClick={() => materialInput.current?.click()}
                  className="mt-2 h-8 px-2"
                >
                  <Paperclip aria-hidden />
                  {curriculum.addMaterial}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
