"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BookOpen, ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { ApiError } from "@/lib/api-client";
import { getLearnRoom } from "@/lib/learn/api";
import { authMessages } from "@/lib/messages/auth";
import { learnMessages } from "@/lib/messages/learn";

/**
 * Sends the student to the first lesson they have not finished.
 *
 * Done in the browser rather than on the server so an expired access token
 * still works: the API client rotates the session and retries, which a Server
 * Component cannot do — it has nowhere to put the new cookie.
 */
export function ResumeRedirect({ courseId }: { courseId: string }) {
  const { room } = learnMessages;
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  const resume = useCallback(async () => {
    setError(null);
    setEmpty(false);

    try {
      const classroom = await getLearnRoom(courseId);

      if (!classroom.resumeLessonId) {
        setEmpty(true);
        return;
      }

      // replace, not push: the doorway must not sit in the back button's way.
      router.replace(`/learn/${courseId}/${classroom.resumeLessonId}`);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
    }
  }, [courseId, router]);

  useEffect(() => {
    void resume();
  }, [resume]);

  if (error) {
    return (
      <Wrapper>
        <EmptyState
          icon={ServerCrash}
          tone="destructive"
          title={room.errorTitle}
          body={error}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => void resume()}>
                {room.retry}
              </Button>
              <Button asChild>
                <Link href="/my-courses">{room.backToMyCourses}</Link>
              </Button>
            </div>
          }
        />
      </Wrapper>
    );
  }

  if (empty) {
    return (
      <Wrapper>
        <EmptyState
          icon={BookOpen}
          title={room.emptyTitle}
          body={room.emptyBody}
          action={
            <Button asChild>
              <Link href="/my-courses">{room.backToMyCourses}</Link>
            </Button>
          }
        />
      </Wrapper>
    );
  }

  return (
    <Wrapper>
      <span className="sr-only">{room.loading}</span>
      <Skeleton className="h-64 rounded-card" />
    </Wrapper>
  );
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">{children}</div>;
}
