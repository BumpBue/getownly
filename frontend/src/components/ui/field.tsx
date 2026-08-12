import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface FieldProps {
  id: string;
  label: string;
  /** Thai validation message from react-hook-form, when the field is invalid. */
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + message, so every form field is spaced and announced the same way. */
export function Field({ id, label, error, hint, className, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>

      <div aria-describedby={describedBy}>{children}</div>

      {error ? (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
