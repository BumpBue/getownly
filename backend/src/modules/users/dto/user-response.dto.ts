import type { Role, UserStatus } from '@prisma/client';

/**
 * The admin's view of one account.
 *
 * Wider than `UserProfileDto` — it carries the email, which an admin needs to
 * match a person to a support message — and narrower than the row it is built
 * from: no `passwordHash`, no tokens, ever (CLAUDE.md, ข้อห้าม 11).
 */
export interface AdminUserDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  /** Fixed-point string, e.g. "0.3000". Only meaningful for instructors. */
  commissionRate: string;
  courseCount: number;
  enrollmentCount: number;
  createdAt: string;
}

/** The tiles above the table. */
export interface UserCountsDto {
  total: number;
  students: number;
  instructors: number;
  admins: number;
  suspended: number;
}

export interface PaginatedAdminUsersDto {
  items: AdminUserDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Whole-platform counts, unaffected by the current filter. */
  counts: UserCountsDto;
}
