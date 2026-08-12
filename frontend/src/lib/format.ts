/**
 * Every number the user sees is formatted here, so a price or a duration looks
 * the same on every screen (CLAUDE.md, "เรื่องเงิน").
 *
 * Money arrives from the API as a fixed-point string ("1290.00"). It is parsed
 * only at this last step, for display: nothing downstream of a formatter ever
 * does arithmetic with the result.
 */

const bahtFormatter = new Intl.NumberFormat("th-TH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeBahtFormatter = new Intl.NumberFormat("th-TH", {
  maximumFractionDigits: 0,
});

const countFormatter = new Intl.NumberFormat("th-TH");

const dateFormatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
});

/** "฿1,290.00" — the form used wherever an exact amount matters. */
export function formatBaht(amount: string): string {
  return `฿${bahtFormatter.format(Number(amount))}`;
}

/** "฿1,290" — for cards, where the trailing ".00" is noise. */
export function formatBahtShort(amount: string): string {
  const value = Number(amount);
  return Number.isInteger(value)
    ? `฿${wholeBahtFormatter.format(value)}`
    : `฿${bahtFormatter.format(value)}`;
}

export function isFree(amount: string): boolean {
  return Number(amount) === 0;
}

export function formatCount(value: number): string {
  return countFormatter.format(value);
}

/** "3 ชม. 25 นาที" · "48 นาที" · "45 วินาที" */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) {
    return "—";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours} ชม. ${minutes} นาที` : `${hours} ชม.`;
  }
  if (minutes > 0) {
    return `${minutes} นาที`;
  }
  return `${totalSeconds} วินาที`;
}

/** "12:05" — the compact form used inside a lesson list. */
export function formatClock(totalSeconds: number | null): string {
  if (totalSeconds === null || totalSeconds <= 0) {
    return "--:--";
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "11 ส.ค. 2569" — Thai Buddhist calendar, which th-TH gives by default. */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) {
    return "—";
  }
  return dateFormatter.format(new Date(isoDate));
}

/** "14:35" — used where the time of day matters, e.g. when a QR stops being shown. */
export function formatTime(isoDate: string | null): string {
  if (!isoDate) {
    return "—";
  }
  return timeFormatter.format(new Date(isoDate));
}

/** "11 ส.ค. 2569 14:35" — for review queues, where "today" is not precise enough. */
export function formatDateTime(isoDate: string | null): string {
  if (!isoDate) {
    return "—";
  }
  const date = new Date(isoDate);
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
}
