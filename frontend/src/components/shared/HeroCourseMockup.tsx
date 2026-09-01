import { CheckCircle2, CirclePlay, FileText } from "lucide-react";
import { landingMessages } from "@/lib/messages/landing";

/**
 * The hero's illustration. No stock photo and no gradient (CLAUDE.md ข้อห้าม
 * 18 forbids gradients everywhere, even here where the brief allowed one as a
 * substitute for a photo) - just a mocked-up lesson player built from plain
 * shapes, tinted with the same tokens as the rest of the app.
 */
export function HeroCourseMockup() {
  const { hero } = landingMessages;

  return (
    <div className="relative w-full max-w-md">
      <div className="absolute -right-4 -top-4 size-24 rounded-full border border-white/15" aria-hidden />
      <div className="absolute -bottom-6 -left-6 size-16 rounded-full bg-secondary/20" aria-hidden />

      <div className="relative overflow-hidden rounded-card border border-white/15 bg-white/5 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <span className="size-2.5 rounded-full bg-destructive/70" aria-hidden />
          <span className="size-2.5 rounded-full bg-pending/70" aria-hidden />
          <span className="size-2.5 rounded-full bg-success/70" aria-hidden />
        </div>

        <div className="relative mt-4 flex aspect-video items-center justify-center rounded-control bg-primary">
          <span className="absolute left-3 top-3 rounded-control bg-white/10 px-2.5 py-1 text-xs font-medium text-white">
            {hero.mockupBadge}
          </span>
          <CirclePlay aria-hidden className="size-14 text-secondary" strokeWidth={1.5} />
        </div>

        <div className="mt-4 space-y-1.5">
          <p className="text-sm font-semibold text-white">{hero.mockupTitle}</p>
          <p className="text-xs text-white/70">{hero.mockupLesson}</p>
        </div>

        <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
          <div className="flex items-center gap-2 text-xs text-white/80">
            <CheckCircle2 aria-hidden className="size-3.5 shrink-0 text-success" />
            <div className="h-1.5 flex-1 rounded-full bg-white/10">
              <div className="h-1.5 w-4/5 rounded-full bg-secondary" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <FileText aria-hidden className="size-3.5 shrink-0" />
            <div className="h-1.5 w-2/3 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
}
