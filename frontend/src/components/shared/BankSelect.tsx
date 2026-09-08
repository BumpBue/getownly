"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { BANKS } from "@getownly/shared";
import { BankLogo } from "@/components/shared/BankLogo";
import { payoutMessages } from "@/lib/messages/payouts";
import { cn } from "@/lib/utils";

/**
 * Picks one of the sixteen banks, by typing or by eye.
 *
 * A native `<select>` was the first choice — it is what the rest of this
 * project uses, and it is keyboard-correct for free — but it cannot show a
 * logo, and sixteen options is exactly the length where a plain list is
 * tedious to scroll on a phone and still too short to justify a combobox
 * library (CLAUDE.md, ข้อห้าม 12). So this is a button that opens a filtered
 * list: the search box narrows sixteen down to one or two, and the whole thing
 * is a `<button>` and an `<input>` with `role="listbox"` around the options —
 * no dependency.
 *
 * Matching runs over the Thai name, the abbreviation and the code, because
 * somebody reaching for Kasikorn will type "กสิกร", "KBANK" or "004" and all
 * three should work.
 */
export function BankSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const labels = payoutMessages.instructor;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = BANKS.find((bank) => bank.code === value) ?? null;

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return BANKS;

    return BANKS.filter(
      (bank) =>
        bank.name.toLowerCase().includes(needle) ||
        bank.abbreviation.toLowerCase().includes(needle) ||
        bank.code.includes(needle),
    );
  }, [query]);

  // Clicking anywhere else closes it, the way a native dropdown would.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen((current) => !current);
          setQuery("");
        }}
        className={cn(
          "flex w-full items-center gap-3 rounded-control border border-border bg-card px-3 py-2 text-left text-sm transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          disabled ? "cursor-not-allowed opacity-60" : "hover:border-primary/40",
        )}
      >
        {selected ? (
          <>
            <BankLogo code={selected.code} size="sm" />
            <span className="min-w-0 flex-1 truncate text-foreground">{selected.name}</span>
          </>
        ) : (
          <span className="flex-1 text-subtle">{labels.bankSelectPlaceholder}</span>
        )}
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-20 mt-1 w-full overflow-hidden rounded-control border border-border bg-card",
            // The only shadow this design allows: a dropdown, and a faint one
            // (CLAUDE.md, หัวข้อ 4).
            "shadow-sm",
          )}
        >
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search aria-hidden className="size-4 shrink-0 text-subtle" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              placeholder={labels.bankSearchPlaceholder}
              onChange={(event) => setQuery(event.target.value)}
              // min-h so the input is a comfortable tap target in its own
              // right, rather than a 20px line inside a padded row.
              className="min-h-9 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-subtle"
            />
          </div>

          <ul role="listbox" aria-label={labels.bankNameLabel} className="max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">{labels.bankSearchEmpty}</li>
            ) : (
              matches.map((bank) => {
                const isSelected = bank.code === value;

                return (
                  <li key={bank.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onChange(bank.code);
                        setOpen(false);
                      }}
                      className={cn(
                        // 44px tall: a comfortable touch target at 375px, where
                        // this list is most of the screen.
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors duration-150",
                        isSelected ? "bg-primary/5 text-primary" : "text-foreground hover:bg-background",
                      )}
                    >
                      <BankLogo code={bank.code} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{bank.name}</span>
                        <span className="block text-xs text-subtle">
                          {bank.abbreviation} · {bank.code}
                        </span>
                      </span>
                      {isSelected && <Check aria-hidden className="size-4 shrink-0" />}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
