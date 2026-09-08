/**
 * Every number the user sees is formatted here, so a price or a duration looks
 * the same on every screen (CLAUDE.md, "เรื่องเงิน").
 *
 * Money arrives from the API as a fixed-point string ("1290.00"). It is parsed
 * only at this last step, for display: nothing downstream of a formatter ever
 * does arithmetic with the result.
 */

const bahtFormatter = new Intl.NumberFormat('th-TH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const wholeBahtFormatter = new Intl.NumberFormat('th-TH', {
  maximumFractionDigits: 0,
});

const countFormatter = new Intl.NumberFormat('th-TH');

const dateFormatter = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
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

/**
 * "17.50%" from the four-decimal rate the API stores ("0.1750").
 *
 * A commission rate is not money, so it does not go through formatBaht — but
 * it is parsed at exactly the same last moment, and only ever to be printed.
 */
export function formatRatePercent(rate: string): string {
  return `${(Number(rate) * 100).toFixed(2)}%`;
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
    return '—';
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
    return '--:--';
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * How long ago an instant was, in whole hours, as "3 ชม." or "2 วัน 5 ชม.".
 *
 * The API sends an ISO instant and the browser subtracts it from its own
 * clock, so nothing here has to know or assume a timezone.
 */
export function formatElapsedSince(isoDate: string): string {
  const totalHours = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 3_600_000));

  if (totalHours < 1) {
    return 'น้อยกว่า 1 ชม.';
  }
  if (totalHours < 24) {
    return `${totalHours} ชม.`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days} วัน ${hours} ชม.` : `${days} วัน`;
}

/** Whole hours since an ISO instant, for comparing against a service target. */
export function hoursSince(isoDate: string): number {
  return Math.max(0, (Date.now() - new Date(isoDate).getTime()) / 3_600_000);
}

/** "11 ส.ค. 2569" — Thai Buddhist calendar, which th-TH gives by default. */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) {
    return '—';
  }
  return dateFormatter.format(new Date(isoDate));
}

/** "14:35" — used where the time of day matters, e.g. when a QR stops being shown. */
export function formatTime(isoDate: string | null): string {
  if (!isoDate) {
    return '—';
  }
  return timeFormatter.format(new Date(isoDate));
}

/** "11 ส.ค. 2569 14:35" — for review queues, where "today" is not precise enough. */
export function formatDateTime(isoDate: string | null): string {
  if (!isoDate) {
    return '—';
  }
  const date = new Date(isoDate);
  return `${dateFormatter.format(date)} ${timeFormatter.format(date)}`;
}
