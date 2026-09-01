import { apiRequest } from '@/lib/api-client';
import type {
  ContentReport,
  ContentReportStatus,
  ContentReportTargetType,
  PaginatedContentReports,
} from './types';

/** Thin wrappers over the content-report endpoints. */

export function reportContent(input: {
  targetType: ContentReportTargetType;
  targetId: string;
  reason: string;
}): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/content-reports', { method: 'POST', body: input });
}

export function listContentReports(
  options: {
    status?: ContentReportStatus;
    page?: number;
  } = {},
): Promise<PaginatedContentReports> {
  const params = new URLSearchParams();
  if (options.status) {
    params.set('status', options.status);
  }
  params.set('page', String(options.page ?? 1));

  return apiRequest<PaginatedContentReports>(`/admin/content-reports?${params.toString()}`);
}

export function reviewContentReport(
  reportId: string,
  input: { status: 'REVIEWED' | 'DISMISSED'; suspendCourse?: boolean },
): Promise<ContentReport> {
  return apiRequest<ContentReport>(`/admin/content-reports/${reportId}/review`, {
    method: 'PATCH',
    body: input,
  });
}

/** Undoes a suspension: the course goes back to PUBLISHED. */
export function restoreCourseFromReport(reportId: string): Promise<ContentReport> {
  return apiRequest<ContentReport>(`/admin/content-reports/${reportId}/restore-course`, {
    method: 'PATCH',
  });
}
