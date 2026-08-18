import * as React from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

interface FieldProps {
  id: string;
  label: string;
  /** Thai validation message from react-hook-form, when the field is invalid. */
  error?: string;
  hint?: string;
  /**
   * Trailing control on the label row - the design's "ลืมรหัสผ่าน" link beside
   * the password label. Kept on the same line so it reads as belonging to this
   * field rather than floating between two of them.
   */
  labelAction?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** Label + control + message, so every form field is spaced and announced the same way. */
export function Field({ id, label, error, hint, labelAction, className, children }: FieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {labelAction ? (
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor={id}>{label}</Label>
          {labelAction}
        </div>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}

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
