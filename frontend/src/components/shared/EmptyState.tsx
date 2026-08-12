import type { LucideIcon } from "lucide-react";

/**
 * The empty and error states every list screen needs (PLAN.md, เฟส 8:
 * "ทุกหน้ามี empty state ... ไม่มีหน้าจอขาวเปล่า").
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  tone = "neutral",
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
  tone?: "neutral" | "destructive";
}) {
  const iconTone = tone === "destructive" ? "text-destructive" : "text-subtle";

  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-border bg-card px-6 py-16 text-center">
      <Icon aria-hidden className={`size-8 ${iconTone}`} />
      <p className="mt-4 text-base font-medium text-foreground">{title}</p>
      {body && <p className="mt-1.5 max-w-md text-sm text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
