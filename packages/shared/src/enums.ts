/**
 * Mirrors the enums declared in backend/prisma/schema.prisma.
 *
 * Prisma generates its own enums for the backend from that same schema, so
 * the backend already has one source of truth and never imports this file -
 * doing so would just add a second, unenforced copy of what Prisma already
 * derives correctly. This file exists for the frontend, which has no build
 * step reading schema.prisma and would otherwise hand-type these values
 * itself in every module that needs them.
 *
 * Thai labels are deliberately not here: CLAUDE.md keeps every domain's
 * user-facing text in frontend/src/lib/messages/*.ts, one place per domain.
 * This file is only the value lists both sides must agree on.
 *
 * When an enum changes in schema.prisma, change it here in the same commit.
 */

export const ROLES = ['STUDENT', 'INSTRUCTOR', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ['ACTIVE', 'SUSPENDED'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const COURSE_STATUSES = [
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'REJECTED',
  'UNPUBLISHED',
  'SUSPENDED',
] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const CONTENT_REPORT_TARGET_TYPES = ['COURSE', 'QNA_THREAD'] as const;
export type ContentReportTargetType = (typeof CONTENT_REPORT_TARGET_TYPES)[number];

export const CONTENT_REPORT_STATUSES = ['PENDING', 'REVIEWED', 'DISMISSED'] as const;
export type ContentReportStatus = (typeof CONTENT_REPORT_STATUSES)[number];

export const TOPUP_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
export type TopupStatus = (typeof TOPUP_STATUSES)[number];

export const ACCOUNT_KINDS = [
  'USER_WALLET',
  'PLATFORM_REVENUE',
  'EXTERNAL_BANK',
  'PAYOUT_PAYABLE',
] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ENTRY_DIRECTIONS = ['DEBIT', 'CREDIT'] as const;
export type EntryDirection = (typeof ENTRY_DIRECTIONS)[number];

export const TX_TYPES = ['TOPUP', 'PURCHASE', 'PAYOUT'] as const;
export type TxType = (typeof TX_TYPES)[number];
