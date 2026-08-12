import { ChevronLeft, ChevronRight } from "lucide-react";
import { walletMessages } from "@/lib/messages/wallet";

/**
 * Previous/next paging for lists whose page lives in React state rather than
 * in the URL — the wallet statement and the admin review queue, both of which
 * reload in place after an action.
 *
 * The catalog uses `CoursePagination` instead, because its filters *are* the
 * URL and every page there has to be linkable.
 */
export function Pager({
  page,
  totalPages,
  disabled = false,
  onChange,
}: {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}) {
  const { pager } = walletMessages;

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav
      aria-label={pager.label}
      className="flex items-center justify-between gap-3 border-t border-border px-5 py-3"
    >
      <PagerButton
        label={pager.previous}
        disabled={disabled || page <= 1}
        onClick={() => onChange(page - 1)}
        icon={<ChevronLeft aria-hidden className="size-4" />}
      />

      <span className="tabular text-sm text-muted">
        {pager.positionPrefix} {page} {pager.positionMiddle} {totalPages}
      </span>

      <PagerButton
        label={pager.next}
        disabled={disabled || page >= totalPages}
        onClick={() => onChange(page + 1)}
        icon={<ChevronRight aria-hidden className="size-4" />}
      />
    </nav>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-9 items-center justify-center rounded-control border border-border bg-card px-3 text-foreground transition-colors duration-150 hover:bg-background disabled:cursor-not-allowed disabled:text-subtle disabled:hover:bg-card"
    >
      {icon}
    </button>
  );
}
