import { BadgeCheck, GraduationCap, QrCode, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RevealOnScroll } from "@/components/shared/RevealOnScroll";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { landingMessages } from "@/lib/messages/landing";

const ICONS: LucideIcon[] = [Wallet, QrCode, BadgeCheck, GraduationCap];

export function WhySection() {
  const { why } = landingMessages;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <RevealOnScroll className="mb-10">
        <SectionHeading title={why.heading} />
      </RevealOnScroll>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {why.items.map((item, index) => {
          const Icon = ICONS[index % ICONS.length];
          return (
            <RevealOnScroll key={item.title} delayMs={index * 80}>
              <div className="flex flex-col items-start gap-3">
                <span className="flex size-11 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Icon aria-hidden className="size-5" />
                </span>
                <h3 className="font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{item.body}</p>
              </div>
            </RevealOnScroll>
          );
        })}
      </div>
    </section>
  );
}
