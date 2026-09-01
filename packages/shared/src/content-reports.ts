import type { ContentReportStatus, ContentReportTargetType, CourseStatus } from './enums';

/**
 * Mirrors backend/src/modules/content-reports/dto/content-report-response.dto.ts.
 * When one side changes, change the other in the same commit.
 */

export interface ContentReportPerson {
  id: string;
  displayName: string;
}

export interface ContentReport {
  id: string;
  targetType: ContentReportTargetType;
  targetId: string;
  reason: string;
  status: ContentReportStatus;
  reporter: ContentReportPerson;
  reviewedBy: ContentReportPerson | null;
  reviewedAt: string | null;
  createdAt: string;
  /** The course's current status when targetType is COURSE; null for QNA_THREAD. */
  courseStatus: CourseStatus | null;
}

export interface PaginatedContentReports {
  items: ContentReport[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
