"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { useToastQueue } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** Mounted once in the root layout; renders whatever useToast() has queued. */
export function Toaster() {
  const { toasts, dismiss } = useToastQueue();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((item) => (
        <div
          key={item.id}
          role={item.tone === "error" ? "alert" : "status"}
          className={cn(
            "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-card border bg-card px-4 py-3 text-sm shadow-sm",
            item.tone === "success" ? "border-success/30" : "border-destructive/30",
          )}
        >
          {item.tone === "success" ? (
            <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
          ) : (
            <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-destructive" />
          )}
          <span className="flex-1 text-foreground">{item.message}</span>
          <button
            type="button"
            onClick={() => dismiss(item.id)}
            className="shrink-0 text-subtle transition-colors duration-150 hover:text-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
