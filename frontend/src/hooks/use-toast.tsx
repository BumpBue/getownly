"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

/**
 * The one toast queue for the whole app, mounted once in the root layout.
 *
 * A form calls `useToast().success(...)` / `.error(...)` after it settles;
 * nothing about where the queue lives or how long a toast stays up is the
 * form's concern.
 */

export type ToastTone = "success" | "error";

export interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  push: (tone: ToastTone, message: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((current) => [...current, { id, tone, message }]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toasts, push, dismiss }}>{children}</ToastContext.Provider>
  );
}

/** What a form calls: `toast.success("บันทึกแล้ว")` / `toast.error(message)`. */
export function useToast(): { success: (message: string) => void; error: (message: string) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast ต้องถูกเรียกภายใน ToastProvider เท่านั้น");
  }
  return {
    success: (message: string) => ctx.push("success", message),
    error: (message: string) => ctx.push("error", message),
  };
}

/** What the <Toaster> mounted in the root layout reads to render the stack. */
export function useToastQueue(): { toasts: ToastItem[]; dismiss: (id: number) => void } {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToastQueue ต้องถูกเรียกภายใน ToastProvider เท่านั้น");
  }
  return { toasts: ctx.toasts, dismiss: ctx.dismiss };
}
