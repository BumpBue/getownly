"use client";

import { GraduationCap, Presentation } from "lucide-react";
import { cn } from "@/lib/utils";
import { SELF_SERVICE_ROLES, type SelfServiceRole } from "@/lib/auth/types";
import { authMessages } from "@/lib/messages/auth";

const ICON_BY_ROLE = {
  STUDENT: GraduationCap,
  INSTRUCTOR: Presentation,
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
            <span className="flex size-11 shrink-0 items-center justify-center rounded-control border border-border text-primary transition-colors duration-150 group-hover:border-primary">
              <Icon aria-hidden className="size-5" />
            </span>

            <span className="flex-1 text-left">
              <span className="block text-base font-semibold text-foreground">{copy.title}</span>
              <span className="mt-1 block text-sm leading-relaxed text-muted">
                {copy.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
