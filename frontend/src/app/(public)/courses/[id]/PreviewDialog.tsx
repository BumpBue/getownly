"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiUrl, refreshSession } from "@/lib/api-client";
import { courseMessages } from "@/lib/messages/courses";

type Failure = "noVideo" | "forbidden" | "expired" | "generic";

/**
 * A free preview lesson, played in place.
 *
 * A native `<dialog>` rather than a Radix overlay: it gives the focus trap, the
 * Escape key and the backdrop for free, with no dependency — the same choice
 * the slip review and payout review screens make (CLAUDE.md, ข้อห้าม 12).
 *
 * The stream is asked for once with `fetch` before the `<video>` is rendered.
 * That costs one small request and buys the thing a bare `<video onError>`
 * cannot give: the reason it failed. A lesson whose video was never uploaded
 * and a session that has expired both leave a `<video>` silently black, and
 * they need opposite advice — one is worth retrying and the other never will
 * be. Seeded demo courses record a videoKey with no bytes behind it, so the
 * first of those is a state somebody will meet by accident during a
 * presentation, not a hypothetical.
 */
export function PreviewDialog({
  lessonId,
  lessonTitle,
  onClose,
}: {
  lessonId: string;
  lessonTitle: string;
  onClose: () => void;
}) {
  const { detail } = courseMessages;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const retriedRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  /**
   * The video reached the browser but would not play.
   *
   * Kept apart from `failure`, which is about not reaching it at all. A file
   * that cannot be decoded still deserves its controls on screen — replacing
   * the player with a message would take away the seek bar and the volume
   * control of a video that may well be only partly broken. The same shape
   * LessonPlayer settled on: the alert goes underneath.
   */
  const [playbackFailed, setPlaybackFailed] = useState(false);

  const source = apiUrl(`/lessons/${lessonId}/stream`);

  useEffect(() => {
    // showModal() is what makes it modal; rendering <dialog open> does not.
    dialogRef.current?.showModal();
  }, []);

  /**
   * Asks for the first byte and reports what came back.
   *
   * Range 0-0 so the probe never pulls a whole video down just to find out
   * whether it is there.
   */
  const probe = useCallback(async (): Promise<void> => {
    setReady(false);
    setFailure(null);

    try {
      const response = await fetch(source, {
        credentials: "include",
        headers: { Range: "bytes=0-0" },
      });

      if (response.ok || response.status === 206) {
        setReady(true);
        return;
      }

      if (response.status === 401 && !retriedRef.current) {
        // One rotation, then believe it: the access token lives fifteen
        // minutes and a page left open outlives it easily.
        retriedRef.current = true;
        if (await refreshSession()) {
          await probe();
          return;
        }
        setFailure("expired");
        return;
      }

      setFailure(
        response.status === 401
          ? "expired"
          : response.status === 403
            ? "forbidden"
            : response.status === 404
              ? "noVideo"
              : "generic",
      );
    } catch {
      setFailure("generic");
    }
  }, [source]);

  useEffect(() => {
    void probe();
  }, [probe]);

  /**
   * Stops playback on the way out.
   *
   * Closing the dialog only hides it; the element keeps playing, and a viewer
   * who has moved on would hear a lesson they can no longer see.
   */
  const close = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      // Detaching the source is what actually ends the request to the API,
      // rather than leaving it streaming into an element nobody can see.
      video.removeAttribute("src");
      video.load();
    }
    onClose();
  }, [onClose]);

  /**
   * One session rotation, then believe it.
   *
   * A page left open outlives a fifteen-minute access token easily, and the
   * browser fetches the video itself, so `apiRequest`'s own retry never sees
   * this. Anything else — a codec the browser will not take, a truncated file
   * — is not going to improve by being asked again.
   */
  const handlePlaybackError = useCallback(() => {
    const video = videoRef.current;
    if (!video || retriedRef.current) {
      setPlaybackFailed(true);
      return;
    }

    retriedRef.current = true;
    void refreshSession().then((rotated) => {
      if (rotated) {
        video.load();
      } else {
        setPlaybackFailed(true);
      }
    });
  }, []);

  const message: Record<Failure, string> = {
    noVideo: detail.previewNoVideo,
    forbidden: detail.previewForbidden,
    expired: detail.previewSessionExpired,
    generic: detail.previewFailed,
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={close}
      onCancel={close}
      aria-label={detail.previewDialogTitle}
      className="w-[min(56rem,calc(100vw-2rem))] rounded-card border border-border bg-card p-0 backdrop:bg-foreground/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs text-muted">{detail.previewDialogTitle}</p>
          <h2 className="truncate text-base font-semibold text-foreground">{lessonTitle}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={close} aria-label={detail.previewClose}>
          <X aria-hidden className="size-4" />
        </Button>
      </div>

      <div className="p-5">
        {failure ? (
          <Alert tone="error">{message[failure]}</Alert>
        ) : ready ? (
          <div className="flex flex-col gap-2">
            <video
              ref={videoRef}
              src={source}
              // The browser fetches this itself, so the cookie has to be
              // asked for explicitly — apiRequest's retry cannot see a <video>.
              crossOrigin="use-credentials"
              controls
              controlsList="nodownload"
              preload="metadata"
              playsInline
              autoPlay
              onError={handlePlaybackError}
              // max-h keeps a tall video inside the viewport at 375px, where
              // the dialog is nearly the whole screen.
              className="max-h-[70vh] w-full rounded-control border border-border bg-foreground"
            />
            {playbackFailed && <Alert tone="error">{detail.previewFailed}</Alert>}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="aspect-video w-full" />
            <p className="text-center text-sm text-muted">{detail.previewLoading}</p>
          </div>
        )}
      </div>
    </dialog>
  );
}
