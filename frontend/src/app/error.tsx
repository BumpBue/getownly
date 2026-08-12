"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ServerCrash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { commonMessages } from "@/lib/messages/common";

/**
 * Catches anything a Server Component throws below the root layout.
 * Next renders its own English "Application error" page when this file is
 * missing, which is exactly the hole CLAUDE.md ข้อห้าม 19 forbids.
 */
export default function GlobalSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { error: messages } = commonMessages;

  useEffect(() => {
    // Nothing on the frontend forwards this anywhere yet; the console is the
    // only trace of it, same as the pattern Next's own examples use here.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-20 sm:px-6 lg:px-8">
      <EmptyState
        icon={ServerCrash}
        tone="destructive"
        title={messages.title}
        body={messages.body}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => reset()}>{messages.retry}</Button>
            <Button asChild variant="outline">
              <Link href="/">{messages.backHome}</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
