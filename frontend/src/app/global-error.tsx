"use client";

import "./globals.css";
import { commonMessages } from "@/lib/messages/common";

/**
 * Only fires when the root layout itself throws — rare, but without this
 * file Next falls back to its own English error screen outside any layout
 * we control. Deliberately plain: no shared components, so a broken import
 * elsewhere in the tree cannot take this page down with it. Re-imports
 * globals.css because this file replaces the root layout entirely, so
 * nothing else brings Tailwind's tokens along.
 */
export default function GlobalError({ reset }: { reset: () => void }) {
  const { error: messages } = commonMessages;

  return (
    <html lang="th">
      <body>
        <div className="flex min-h-screen items-center justify-center bg-background px-4 py-20">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-card border border-border bg-card px-6 py-10 text-center">
            <p className="text-base font-medium text-foreground">{messages.title}</p>
            <p className="text-sm text-muted">{messages.body}</p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-2 inline-flex h-11 items-center justify-center rounded-control bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {messages.retry}
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
