import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A photo, or two letters on a primary-tinted circle when there is none.
 *
 * Hand-rolled rather than Radix: unlike the dropdown menu this sits in, there
 * is no keyboard interaction or focus management to get right here, only an
 * image with a fallback — the same reasoning that kept select/tabs off Radix
 * elsewhere in this codebase (CLAUDE.md, ข้อห้าม 12).
 */
const SIZE_CLASSES = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-16 text-xl",
} as const;

export function Avatar({
  src,
  name,
  size = "md",
  className,
}: {
  src: string | null;
  /** Used to derive the fallback initial when there is no photo. */
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = src !== null && !failed;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-semibold text-primary-foreground",
        SIZE_CLASSES[size],
        className,
      )}
    >
      {showImage ? (
        // A signed URL of unknown, user-uploaded dimensions - next/image would
        // need a fixed intrinsic size and gains nothing here (same reasoning
        // as the slip/QR images elsewhere in this app).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-hidden>{initialOf(name)}</span>
      )}
    </span>
  );
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?";
}
