/**
 * Mirrors the enums declared in backend/prisma/schema.prisma.
 * Prisma generates its own enums for the backend; the frontend imports these
 * so both sides agree on the exact string values.
 *
 * When an enum changes in schema.prisma, change it here in the same commit.
 */

export const Role = {
  STUDENT: 'STUDENT',
  INSTRUCTOR: 'INSTRUCTOR',
  ADMIN: 'ADMIN',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const CourseStatus = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  PUBLISHED: 'PUBLISHED',
  REJECTED: 'REJECTED',
} as const;
export type CourseStatus = (typeof CourseStatus)[keyof typeof CourseStatus];

export const TopupStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type TopupStatus = (typeof TopupStatus)[keyof typeof TopupStatus];

export const AccountKind = {
  USER_WALLET: 'USER_WALLET',
  PLATFORM_REVENUE: 'PLATFORM_REVENUE',
  EXTERNAL_BANK: 'EXTERNAL_BANK',
} as const;
export type AccountKind = (typeof AccountKind)[keyof typeof AccountKind];

export const EntryDirection = {
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
} as const;
export type EntryDirection = (typeof EntryDirection)[keyof typeof EntryDirection];

export const TxType = {
  TOPUP: 'TOPUP',
  PURCHASE: 'PURCHASE',
} as const;
export type TxType = (typeof TxType)[keyof typeof TxType];

/** Thai labels for values that are shown to the user. */
export const ROLE_LABEL_TH: Record<Role, string> = {
  STUDENT: 'ผู้เรียน',
  INSTRUCTOR: 'ผู้สอน',
  ADMIN: 'ผู้ดูแลระบบ',
};

export const COURSE_STATUS_LABEL_TH: Record<CourseStatus, string> = {
  DRAFT: 'ฉบับร่าง',
  PENDING_REVIEW: 'รอตรวจสอบ',
  PUBLISHED: 'เผยแพร่แล้ว',
  REJECTED: 'ถูกปฏิเสธ',
};

export const TOPUP_STATUS_LABEL_TH: Record<TopupStatus, string> = {
  PENDING: 'รอตรวจสอบ',
  APPROVED: 'อนุมัติแล้ว',
  REJECTED: 'ถูกปฏิเสธ',
};
