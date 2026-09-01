import type { ContentReportStatus, ContentReportTargetType } from '@prisma/client';

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
}

export interface PaginatedContentReportsDto {
  items: ContentReportDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
