"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VideoOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { apiUrl, refreshSession } from "@/lib/api-client";
import { completeLesson, saveProgress } from "@/lib/learn/api";
import {
  COMPLETION_RATIO,
  PROGRESS_SAVE_INTERVAL_MS,
  type LearnLesson,
  type ProgressResult,
} from "@/lib/learn/types";
import { learnMessages } from "@/lib/messages/learn";

/**
 * The video, and everything that has to happen while it plays.
 *
 * Two things are reported back to the API: where the player is, every ten
 * seconds, and the fact that the lesson is finished once 90% of it has gone by.
 * Both are cheap on purpose — a position is one integer, and completion is sent
 * exactly once per visit.
 *
 * The source is the API's own streaming route, not a link to storage: every
 * request, including every seek, is re-authorised on the server
 * (CLAUDE.md, ข้อห้าม 10). That also means the browser is fetching it with its
 * own cookies, so `crossOrigin="use-credentials"` is what makes the session
 * travel with it.
 */
export function LessonPlayer({
  lesson,
  onProgress,
}: {
  lesson: LearnLesson;
  onProgress: (result: ProgressResult) => void;
}) {
  const { player } = learnMessages;

  const videoRef = useRef<HTMLVideoElement>(null);
  /** Where the player is right now. A ref, so ticking does not re-render. */
  const positionRef = useRef(lesson.progress.lastPositionSec);
  /** The last position the API was told about. */
  const savedRef = useRef(lesson.progress.lastPositionSec);
  /** Guards against sending "finished" once per timeupdate event. */
  const completedRef = useRef(lesson.progress.isCompleted);
  /** One session rotation per player, so a dead session cannot loop. */
  const retriedRef = useRef(false);

  const [failed, setFailed] = useState(false);

  const source = lesson.videoStreamUrl ? apiUrl(lesson.videoStreamUrl) : null;

  const flush = useCallback(async () => {
    const position = Math.floor(positionRef.current);
    // A pause, or a tick that moved less than a second, is not worth a request.
    if (Math.abs(position - savedRef.current) < 1) {
      return;
    }

    try {
      onProgress(await saveProgress(lesson.id, position));
      // Marked only on success, so a failed save is simply retried by the next
      // tick — losing a bookmark is not worth interrupting a lesson over.
      savedRef.current = position;
    } catch {
      // Deliberately silent: the student is watching a video, not a form.
    }
  }, [lesson.id, onProgress]);

  const markComplete = useCallback(async () => {
    try {
      onProgress(await completeLesson(lesson.id));
    } catch {
      // Let the next 90% crossing, or the button below the video, try again.
      completedRef.current = false;
    }
  }, [lesson.id, onProgress]);

  // Reset when the student moves to another lesson: this component is reused.
  useEffect(() => {
    positionRef.current = lesson.progress.lastPositionSec;
    savedRef.current = lesson.progress.lastPositionSec;
    completedRef.current = lesson.progress.isCompleted;
    retriedRef.current = false;
    setFailed(false);
  }, [lesson.id, lesson.progress.isCompleted, lesson.progress.lastPositionSec]);

  useEffect(() => {
    const timer = window.setInterval(() => void flush(), PROGRESS_SAVE_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      // Leaving the page is exactly when the position matters most.
      void flush();
    };
  }, [flush]);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    const resumeAt = lesson.progress.lastPositionSec;

    // Resuming within the last few seconds would replay the end and nothing
    // else, so a nearly-finished lesson starts over instead.
    if (video && resumeAt > 0 && Number.isFinite(video.duration) && resumeAt < video.duration - 5) {
      video.currentTime = resumeAt;
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    positionRef.current = video.currentTime;

    if (!completedRef.current && video.duration > 0) {
      if (video.currentTime / video.duration >= COMPLETION_RATIO) {
        completedRef.current = true;
        void markComplete();
      }
    }
  };

  /**
   * A 401 here is almost always the 15-minute access token expiring mid-lesson.
   * The browser fetched this itself, so the retry built into the API client
   * never saw it: rotate the session once by hand and reload the source.
   */
  const handleError = () => {
    const video = videoRef.current;
    if (!video || retriedRef.current) {
      setFailed(true);
      return;
    }

    retriedRef.current = true;
    void refreshSession().then((ok) => {
      if (ok) {
        video.load();
      } else {
        setFailed(true);
      }
    });
  };

  if (!source) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-card border border-border bg-foreground/95 text-subtle">
        <VideoOff aria-hidden className="size-8" />
        <p className="text-sm">{player.noVideo}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <video
        ref={videoRef}
        key={lesson.id}
        src={source}
        crossOrigin="use-credentials"
        controls
        controlsList="nodownload"
        preload="metadata"
        playsInline
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPause={() => void flush()}
        onEnded={() => {
          if (!completedRef.current) {
            completedRef.current = true;
            void markComplete();
          }
        }}
        onError={handleError}
        className="aspect-video w-full rounded-card border border-border bg-foreground"
      />

      {failed && <Alert tone="error">{player.loadFailed}</Alert>}
    </div>
  );
}
