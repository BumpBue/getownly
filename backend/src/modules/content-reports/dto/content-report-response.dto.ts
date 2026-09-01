import type { ContentReportStatus, ContentReportTargetType, CourseStatus } from '@prisma/client';

/**
 * Every one of these is built by an explicit mapper, never a raw Prisma row
 * (CLAUDE.md, ข้อห้าม 11): a reporter's email must not ride along on a queue
 * an admin is scrolling through.
 */

export interface ContentReportPersonDto {
  id: string;
  displayName: string;
}

export interface ContentReportDto {
  id: string;
  targetType: ContentReportTargetType;
  targetId: string;
  reason: string;
  status: ContentReportStatus;
  reporter: ContentReportPersonDto;
  reviewedBy: ContentReportPersonDto | null;
  reviewedAt: string | null;
  createdAt: string;
  /**
   * The course's current status, only when targetType is COURSE — null for a
   * QNA_THREAD report. Lets the admin queue show "restore" only where the
   * course is actually SUSPENDED right now, without a second round trip.
   */
  courseStatus: CourseStatus | null;
}

export interface PaginatedContentReportsDto {
  items: ContentReportDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
