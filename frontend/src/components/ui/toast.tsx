"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { Toaster as SonnerToaster } from "sonner";

/**
 * Mounted once in the root layout. `sonner` renders the stack; every visual
 * choice here is `unstyled` + our own classes so a toast looks like the rest
 * of the system - the design tokens in globals.css, not sonner's defaults.
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      gap={8}
      icons={{
        success: <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" />,
        error: <XCircle aria-hidden className="size-4 shrink-0 text-destructive" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full max-w-sm items-start gap-2.5 rounded-card border bg-card px-4 py-3 text-sm text-foreground shadow-sm",
          success: "border-success/30",
          error: "border-destructive/30",
          title: "flex-1",
          closeButton:
            "!left-auto !right-1.5 !top-1.5 !border-none !bg-transparent text-subtle transition-colors duration-150 hover:!bg-background hover:text-foreground",
        },
      }}
      closeButton
    />
  );
}
