"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./input";
import { authMessages } from "@/lib/messages/auth";
import { cn } from "@/lib/utils";

/**
 * The design's show/hide password control - its inline `onclick` rewritten as
 * React state.
 *
 * The toggle button is deliberately outside the tab order (`tabIndex={-1}`):
 * someone filling the form with the keyboard tabs password -> submit, and a
 * stop in between to reach a button they did not ask for is a snag on the one
 * path everybody takes. Pointer and screen-reader users still reach it, the
 * latter through `aria-label`, which flips with the state so it announces what
 * the next press will do rather than what is on screen now.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, ...props }, ref) => {
    const [isVisible, setIsVisible] = React.useState(false);
    const t = authMessages.passwordToggle;
    const Icon = isVisible ? EyeOff : Eye;

    return (
      <div className="relative">
        <Input
          ref={ref}
          type={isVisible ? "text" : "password"}
          // Room for the button so a long value never slides underneath it.
          className={cn("pr-11", className)}
          {...props}
        />

        <button
          type="button"
          tabIndex={-1}
          onClick={() => setIsVisible((visible) => !visible)}
          aria-label={isVisible ? t.hide : t.show}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-control text-subtle transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <Icon aria-hidden className="size-4" />
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";
