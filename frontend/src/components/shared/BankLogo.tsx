"use client";

import { useState } from "react";
import { bankLogoPath, findBank } from "@getownly/shared";
import { cn } from "@/lib/utils";

const SIZE_CLASSES = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
} as const;

const TEXT_CLASSES = {
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
} as const;

/**
 * A bank's mark, at a fixed square size whatever the file behind it looks like.
 *
 * Three things have to end up looking like one set:
 *
 *   - logos with a transparent background (the GIFs),
 *   - logos with white baked in (the JPEGs), and
 *   - banks with no file supplied at all.
 *
 * So every one of them is drawn inside the same white square with a hairline
 * border and `object-contain`. The white ground is what makes an opaque JPEG
 * sit beside a transparent GIF without looking pasted on, and `object-contain`
 * is what stops a differently-proportioned file from being drawn larger than
 * its neighbours. The page has no dark mode (CLAUDE.md, หัวข้อ 4), so a white
 * square is never a light patch on a dark ground.
 *
 * A missing file is not an error state: the badge shows the bank's initials on
 * its own brand colour, and `onError` falls back to the same badge if a file
 * disappears after the page was written.
 *
 * `<img>`, not `next/image` — the optimiser runs on the server, and this
 * project hands it nothing (CLAUDE.md, "ห้ามใช้ next/image กับไฟล์จาก MinIO";
 * the same choice applies to every image here for consistency).
 */
export function BankLogo({
  code,
  size = "md",
  className,
}: {
  code: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const bank = findBank(code);
  const src = bankLogoPath(code);
  const showImage = src !== null && !failed;

  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-control border border-border",
        SIZE_CLASSES[size],
        showImage ? "bg-white" : "",
        className,
      )}
      style={showImage ? undefined : { backgroundColor: bank?.brandColor ?? "#6B7280" }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- a static app asset; next/image adds nothing and this project uses none
        <img
          src={src}
          alt=""
          className="size-full object-contain p-1"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className={cn("font-semibold text-white", TEXT_CLASSES[size])}>
          {bank?.initials ?? "?"}
        </span>
      )}
    </span>
  );
}
