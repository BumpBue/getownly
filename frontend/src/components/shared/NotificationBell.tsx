"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { navMessages } from "@/lib/messages/nav";

/**
 * A placeholder, honestly: there is no Notification model yet (CLAUDE.md,
 * หัวข้อ 8), so this shows no badge and no invented unread count - only a
 * button that opens a panel saying so.
 */
export function NotificationBell() {
  const { notifications: messages } = navMessages;
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={messages.ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex size-10 items-center justify-center rounded-control text-muted transition-colors duration-150 hover:bg-background hover:text-foreground"
      >
        <Bell aria-hidden className="size-5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-card border border-border bg-card shadow-sm">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-foreground">
            {messages.title}
          </h2>
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <BellOff aria-hidden className="size-6 text-subtle" />
            <p className="text-sm text-muted">{messages.empty}</p>
            <p className="text-xs text-subtle">{messages.comingSoon}</p>
          </div>
        </div>
      )}
    </div>
  );
}
