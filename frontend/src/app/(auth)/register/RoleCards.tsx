"use client";

import { ArrowRight, GraduationCap, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELF_SERVICE_ROLES, type SelfServiceRole } from "@/lib/auth/types";
import { authMessages } from "@/lib/messages/auth";

const ICON_BY_ROLE = {
  STUDENT: GraduationCap,
  INSTRUCTOR: Presentation,
} as const;

/**
 * The design tints the two role tiles differently - navy for the learner,
 * gold for the teacher - so the choice reads as two different doors rather
 * than one list with two rows.
 */
const ICON_TONE_BY_ROLE = {
  STUDENT: "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
  INSTRUCTOR:
    "bg-secondary/15 text-secondary group-hover:bg-secondary group-hover:text-secondary-foreground",
} as const;

interface RoleCardsProps {
  onSelect: (role: SelfServiceRole) => void;
}

/** Step one of registration: pick a role before anything else is asked. */
export function RoleCards({ onSelect }: RoleCardsProps) {
  const t = authMessages.register;

  return (
    <div className="grid gap-4">
      {SELF_SERVICE_ROLES.map((role) => {
        const Icon = ICON_BY_ROLE[role];
        const copy = t.roles[role];

        return (
          <button
            key={role}
            type="button"
            onClick={() => onSelect(role)}
            className={cn(
              "group flex w-full items-start gap-4 rounded-card border border-border bg-card p-5 text-right",
              "transition-colors duration-150 hover:border-primary",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            )}
          >
            <span
              className={cn(
                "flex size-12 shrink-0 items-center justify-center rounded-control transition-colors duration-150",
                ICON_TONE_BY_ROLE[role],
              )}
            >
              <Icon aria-hidden className="size-6" />
            </span>

            <span className="flex-1 text-left">
              <span className="block text-base font-semibold text-primary">{copy.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">
                {copy.description}
              </span>
            </span>

            {/*
              The design marks the chosen tile with a check, but choosing here
              moves straight on to the form rather than waiting for a separate
              "ดำเนินการต่อ" press - so there is no selected state to draw.
              An arrow says what the press actually does instead of a tick
              that would be true for only one frame.
            */}
            <ArrowRight
              aria-hidden
              className="mt-3 size-5 shrink-0 text-subtle transition-all duration-150 group-hover:translate-x-1 group-hover:text-primary"
            />
          </button>
        );
      })}
    </div>
  );
}
