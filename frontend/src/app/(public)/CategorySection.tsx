import Link from "next/link";
import {
  BookOpen,
  Briefcase,
  Camera,
  Code2,
  LineChart,
  Megaphone,
  Music2,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { RevealOnScroll } from "@/components/shared/RevealOnScroll";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCount } from "@/lib/format";
import { landingMessages } from "@/lib/messages/landing";
import type { Category } from "@/lib/catalog/types";

/**
 * Categories are admin-created Thai text with no icon field of their own, so
 * an icon is assigned by position rather than guessed from the name - stable
 * across renders because the caller always passes them in the same order.
 */
const CATEGORY_ICONS: LucideIcon[] = [BookOpen, Code2, Palette, Megaphone, Camera, LineChart, Briefcase, Music2];

export function CategorySection({ categories }: { categories: Category[] }) {
  const { categories: messages } = landingMessages;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <RevealOnScroll className="mb-8">
        <SectionHeading title={messages.heading} subtitle={messages.subheading} />
      </RevealOnScroll>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((category, index) => {
          const Icon = CATEGORY_ICONS[index % CATEGORY_ICONS.length];
          return (
            <RevealOnScroll key={category.id} delayMs={index * 80}>
              {/*
                Square on tablet and up, matching the design's category tiles.
                Left as free-height on phones, where a square would push four
                stacked cards well past a screenful.
              */}
              <Link
                href={`/courses?categoryId=${category.id}`}
                className="group flex h-full flex-col items-center justify-center gap-3 rounded-card border border-border bg-card p-6 text-center transition-all duration-150 hover:-translate-y-1 hover:border-primary/40 sm:aspect-square"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary transition-all duration-150 group-hover:scale-110 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon aria-hidden className="size-7" />
                </span>
                <span className="text-lg font-semibold text-foreground">{category.name}</span>
                <span className="tabular text-xs text-subtle">
                  {formatCount(category.courseCount)} {messages.coursesSuffix}
                </span>
              </Link>
            </RevealOnScroll>
          );
        })}
      </div>
    </section>
  );
}
