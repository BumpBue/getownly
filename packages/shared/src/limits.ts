/**
 * Numeric limits fixed by the project scope document (ทก.01).
 *
 * This file is the single source of truth for every one of them. They are not
 * deployment configuration: a running instance must not be able to raise a
 * ceiling that the thesis document promises, so none of these live in `.env`.
 * Both the API and the web app import from here, and the API's DTOs, upload
 * rules and database CHECK constraints are all derived from these constants.
 *
 * When a number here changes, the migration holding the matching CHECK
 * constraint has to change with it — see CLAUDE.md, "ค่าคงที่ของขอบเขต".
 */

import type { UploadKind } from './catalog';

// --- courses ----------------------------------------------------------------

/** ทก.01 A4: no course may be priced above this, in baht. Free (0) is allowed. */
export const COURSE_MAX_PRICE_BAHT = 10_000;

/**
 * ทก.01 A6: total bytes one course's lesson videos and materials may use,
 * combined. Checked against `Course.storageUsedBytes`, a running total, never
 * by summing every file the course owns on every request.
 */
export const COURSE_MAX_STORAGE_BYTES = 1 * 1024 * 1024 * 1024;

// --- uploads ----------------------------------------------------------------

/**
 * ทก.01 A6: size ceiling per file, in megabytes.
 *
 * `video` is the number the scope document names (150 MB per clip). The rest
 * are project choices the document does not constrain, kept here so there is
 * exactly one table of file sizes in the repository.
 */
export const UPLOAD_MAX_MB: Record<UploadKind, number> = {
  video: 150,
  material: 50,
  cover: 5,
  avatar: 5,
  slip: 5,
};

// --- quizzes ----------------------------------------------------------------

/** ทก.01 A7: the pass mark an instructor may set, as a percentage, inclusive. */
export const QUIZ_PASS_SCORE_MIN = 60;
export const QUIZ_PASS_SCORE_MAX = 100;

// --- service levels ---------------------------------------------------------

/**
 * ทก.01 D3: how long a wallet top-up should wait before an admin has reviewed
 * the slip. Advisory — nothing expires when it is exceeded; the queue simply
 * flags the request so it stops being invisible.
 */
export const TOPUP_REVIEW_TARGET_HOURS = 24;

// --- formatting helpers -----------------------------------------------------

const BYTES_PER_MB = 1024 * 1024;

export function mbToBytes(mb: number): number {
  return mb * BYTES_PER_MB;
}

/**
 * "1 GB", "950 MB", "74 MB" — the wording every quota message uses, so a
 * student and an instructor are never shown the same number two ways.
 */
export function formatBytesThai(bytes: number): string {
  const gb = 1024 * 1024 * 1024;
  if (bytes >= gb) {
    const value = bytes / gb;
    return `${Number.isInteger(value) ? value : value.toFixed(2)} GB`;
  }
  return `${Math.round(bytes / BYTES_PER_MB)} MB`;
}
