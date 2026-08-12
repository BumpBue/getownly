"use client";

import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-client";
import { setUserCommission } from "@/lib/admin/api";
import type { AdminUser } from "@/lib/admin/types";
import { adminMessages } from "@/lib/messages/admin";
import { authMessages } from "@/lib/messages/auth";

/**
 * Sets one instructor's platform share.
 *
 * The admin types whole percent, which is how people talk about it; the rate
 * goes to the API as the fixed-point fraction the Decimal column holds. The
 * conversion happens once, here, and `toFixed(4)` keeps it exact — 12 percent
 * must be "0.1200" and never 0.12000000000000001.
 *
 * A native `<dialog>` rather than Radix: focus trap, Escape and backdrop come
 * free from the browser (CLAUDE.md, ข้อห้าม 12), as the slip review uses.
 */
export function CommissionDialog({
  user,
  onSaved,
  onClose,
}: {
  user: AdminUser;
  onSaved: (updated: AdminUser) => void;
  onClose: () => void;
}) {
  const { users: messages } = adminMessages;

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [percent, setPercent] = useState(() =>
    String(Math.round(Number(user.commissionRate) * 100)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rendering `<dialog open>` is not the same as opening a modal: only
  // showModal() gives the backdrop and the focus trap.
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const numeric = Number(percent);
  const valid = Number.isFinite(numeric) && numeric >= 0 && numeric <= 50;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      onSaved(await setUserCommission(user.id, (numeric / 100).toFixed(4)));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : authMessages.errors.unexpected);
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-[min(28rem,calc(100vw-2rem))] rounded-card border border-border bg-card p-0 backdrop:bg-foreground/40"
    >
      <form onSubmit={(event) => void save(event)} className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">{messages.commissionTitle}</h2>
          <p className="mt-1 text-sm text-muted">{user.displayName}</p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <p className="text-sm text-muted">{messages.commissionHelp}</p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commission">{messages.commissionLabel}</Label>
          <div className="flex items-center gap-2">
            <Input
              id="commission"
              type="number"
              min={0}
              max={50}
              step={1}
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
              className="tabular w-28"
              required
            />
            <span className="text-sm text-muted">%</span>
          </div>
        </div>

        {valid && (
          <p className="tabular rounded-control border border-border bg-background px-3 py-2 text-sm text-muted">
            {messages.instructorGets}{" "}
            <span className="font-semibold text-foreground">{100 - numeric}%</span>
          </p>
        )}

        <p className="text-xs text-subtle">{messages.commissionNote}</p>

        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => dialogRef.current?.close()}
          >
            {messages.cancel}
          </Button>
          <Button type="submit" disabled={saving || !valid}>
            {saving ? messages.saving : messages.save}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
