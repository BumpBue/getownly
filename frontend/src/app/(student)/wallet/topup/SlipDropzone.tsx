"use client";

import { useCallback, useRef, useState } from "react";
import { FileImage, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { walletMessages } from "@/lib/messages/wallet";
import { checkFileBeforeUpload, uploadFile, UploadError } from "@/lib/catalog/upload";
import { cn } from "@/lib/utils";

/**
 * Drag-and-drop for the transfer slip.
 *
 * The file goes straight to MinIO with a presigned PUT and never passes
 * through the API; what comes back is the object key, which is all the top-up
 * request carries. The preview is a local `blob:` URL, so it appears the
 * instant the file is chosen rather than after a round trip.
 */
export function SlipDropzone({
  slipKey,
  onUploaded,
  onCleared,
  disabled = false,
}: {
  slipKey: string | null;
  onUploaded: (slipKey: string) => void;
  onCleared: () => void;
  disabled?: boolean;
}) {
  const { topup } = walletMessages;
  const inputRef = useRef<HTMLInputElement>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const clear = useCallback(() => {
    setPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }
      return null;
    });
    setFileName(null);
    setProgress(null);
    setError(null);
    onCleared();
  }, [onCleared]);

  const accept = useCallback(
    async (file: File) => {
      const problem = checkFileBeforeUpload("slip", file);
      if (problem) {
        setError(problem);
        return;
      }

      clear();
      setPreviewUrl(URL.createObjectURL(file));
      setFileName(file.name);
      setProgress(0);

      try {
        const result = await uploadFile("slip", file, setProgress).promise;
        onUploaded(result.fileKey);
      } catch (caught) {
        setError(caught instanceof UploadError ? caught.message : String(caught));
        setProgress(null);
      }
    },
    [clear, onUploaded],
  );

  const uploading = progress !== null && slipKey === null && error === null;

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setDragging(true);
          }
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files[0];
          if (file && !disabled) {
            void accept(file);
          }
        }}
        className={cn(
          "rounded-card border border-dashed border-border bg-background p-6 text-center transition-colors duration-150",
          dragging && "border-primary bg-primary/5",
          disabled && "opacity-60",
        )}
      >
        {previewUrl ? (
          <div className="flex flex-col items-center gap-3">
            {/* A local blob: URL of unknown dimensions — next/image needs a
                known size or an allow-listed host, and has neither here. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={topup.slipPreviewAlt}
              className="max-h-64 w-auto rounded-control border border-border bg-card object-contain"
            />
            <p className="text-xs text-muted">{fileName}</p>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
              >
                <Upload aria-hidden />
                {topup.dropzoneChange}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={clear}
              >
                <X aria-hidden />
                {topup.removeSlip}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 py-6 disabled:cursor-not-allowed"
          >
            <FileImage aria-hidden className="size-8 text-subtle" />
            <span className="text-sm font-medium text-foreground">{topup.dropzoneTitle}</span>
            <span className="text-xs text-subtle">{topup.dropzoneHint}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void accept(file);
          }
          // Cleared so picking the same file twice still fires a change.
          event.target.value = "";
        }}
      />

      {uploading && <Progress value={progress ?? 0} label={topup.uploading} />}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
