import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * A bottom bar that only exists while a long form has unsaved changes.
 *
 * Lives outside the form's own scroll area (`fixed`, not `sticky`) so it
 * stays reachable on a long form without following the cursor around inside
 * it - a save action should not require scrolling back up or down to find.
 */
export function StickySaveBar({
  visible,
  message,
  saveLabel,
  savingLabel,
  saving,
  disabled,
}: {
  visible: boolean;
  message: string;
  saveLabel: string;
  savingLabel: string;
  saving: boolean;
  disabled?: boolean;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div
      style={{ animation: "dropdown-in 150ms ease-out" }}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <p className="text-sm text-pending">{message}</p>
        <Button type="submit" size="sm" disabled={disabled || saving}>
          <Save aria-hidden />
          {saving ? savingLabel : saveLabel}
        </Button>
      </div>
    </div>
  );
}
