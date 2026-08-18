import Link from "next/link";
import { RevealOnScroll } from "@/components/shared/RevealOnScroll";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Button } from "@/components/ui/button";
import { landingMessages } from "@/lib/messages/landing";

export function InstructorSection() {
  const { instructor } = landingMessages;

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <SectionHeading size="lg" title={instructor.heading} subtitle={instructor.subheading} />
        </RevealOnScroll>

        <div className="mt-10 grid gap-8 sm:grid-cols-3">
          {instructor.steps.map((step, index) => (
            <RevealOnScroll key={step.title} delayMs={index * 80}>
              <div className="flex flex-col items-center gap-3 text-center">
                <span className="tabular flex size-11 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <h3 className="font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll className="mt-10 flex justify-center">
          <Button asChild size="lg">
            <Link href="/register?role=instructor">{instructor.cta}</Link>
          </Button>
        </RevealOnScroll>
      </div>
    </section>
  );
}
