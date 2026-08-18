import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthFormHeaderProps {
  title: string;
  subtitle: string;
  /**
   * The design badges the one-purpose auth screens - forgot password, reset
   * password - with an icon above the title, because those two arrive with no
   * surrounding context: someone lands there straight from an email link and
   * the icon says what kind of screen it is before the sentence is read.
   * Login and register keep it off; they are reached deliberately.
   */
  icon?: LucideIcon;
  /** `success` badges the confirmation state after the mail has gone out. */
  tone?: "primary" | "success";
  align?: "left" | "center";
}

const TONE_CLASS = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
} as const;

export function AuthFormHeader({
  title,
  subtitle,
  icon: Icon,
  tone = "primary",
  align = "left",
}: AuthFormHeaderProps) {
  const isCentered = align === "center";

  return (
    <header className={cn("mb-8", isCentered && "text-center")}>
      {Icon && (
        <span
          className={cn(
            "mb-4 inline-flex size-12 items-center justify-center rounded-control",
            TONE_CLASS[tone],
          )}
        >
          <Icon aria-hidden className="size-6" />
        </span>
      )}

      <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
    </header>
  );
}
