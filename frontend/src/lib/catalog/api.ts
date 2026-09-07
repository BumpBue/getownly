import { apiRequest } from '@/lib/api-client';
import type {
  Category,
  CourseDetail,
  InstructorCourse,
  InstructorStats,
  Lesson,
  Material,
  PaginatedCourses,
  PaginatedCourseStudents,
  PresignUploadResponse,
  SignedUrlResponse,
  UploadKind,
} from './types';

/** Thin wrappers over the catalog endpoints, called from client components. */

// --- public ----------------------------------------------------------------

export function listCategories(): Promise<Category[]> {
  return apiRequest<Category[]>('/categories');
}

export function listCourses(query: string): Promise<PaginatedCourses> {
  return apiRequest<PaginatedCourses>(`/courses${query ? `?${query}` : ''}`);
}

export function getCourse(courseId: string): Promise<CourseDetail> {
  return apiRequest<CourseDetail>(`/courses/${courseId}`);
}

// --- instructor: courses ---------------------------------------------------

/**
 * ทก.01 A9: who is enrolled in one of my courses, and how they are doing.
 * Refused with NOT_COURSE_OWNER for a course belonging to somebody else.
 */
export function getCourseStudents(
  courseId: string,
  page = 1,
): Promise<PaginatedCourseStudents> {
  return apiRequest<PaginatedCourseStudents>(
    `/instructor/courses/${courseId}/students?page=${page}`,
  );
}

export function listMyCourses(): Promise<InstructorCourse[]> {
  return apiRequest<InstructorCourse[]>('/courses/mine');
}

export function getMyStats(): Promise<InstructorStats> {
  return apiRequest<InstructorStats>('/courses/mine/stats');
}

export interface CourseInput {
  title?: string;
  description?: string;
  categoryId?: string;
  price?: string;
  coverKey?: string;
}

export function createCourse(input: CourseInput): Promise<CourseDetail> {
  return apiRequest<CourseDetail>('/courses', { method: 'POST', body: input });
}

export function updateCourse(courseId: string, input: CourseInput): Promise<CourseDetail> {
  return apiRequest<CourseDetail>(`/courses/${courseId}`, { method: 'PATCH', body: input });
}

export function deleteCourse(courseId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/courses/${courseId}`, { method: 'DELETE' });
}

export function submitCourse(courseId: string): Promise<CourseDetail> {
  return apiRequest<CourseDetail>(`/courses/${courseId}/submit`, { method: 'POST' });
}

/** Takes a published course off the market without deleting it. */
export function unpublishCourse(courseId: string): Promise<CourseDetail> {
  return apiRequest<CourseDetail>(`/courses/${courseId}/unpublish`, { method: 'POST' });
}

// --- instructor: lessons ---------------------------------------------------

export function listLessons(courseId: string): Promise<Lesson[]> {
  return apiRequest<Lesson[]>(`/courses/${courseId}/lessons`);
}

export interface LessonInput {
  title?: string;
  videoKey?: string;
  durationSec?: number;
  isPreview?: boolean;
}

export function createLesson(courseId: string, input: LessonInput): Promise<Lesson> {
  return apiRequest<Lesson>(`/courses/${courseId}/lessons`, { method: 'POST', body: input });
}

export function updateLesson(lessonId: string, input: LessonInput): Promise<Lesson> {
  return apiRequest<Lesson>(`/lessons/${lessonId}`, { method: 'PATCH', body: input });
}

export function deleteLesson(lessonId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/lessons/${lessonId}`, { method: 'DELETE' });
}

export function reorderLessons(courseId: string, lessonIds: string[]): Promise<Lesson[]> {
  return apiRequest<Lesson[]>(`/courses/${courseId}/lessons/reorder`, {
    method: 'PATCH',
    body: { lessonIds },
  });
}

// --- instructor: materials -------------------------------------------------

export interface MaterialInput {
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
}

export function createMaterial(lessonId: string, input: MaterialInput): Promise<Material> {
  return apiRequest<Material>(`/lessons/${lessonId}/materials`, { method: 'POST', body: input });
}

export function deleteMaterial(materialId: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(`/materials/${materialId}`, { method: 'DELETE' });
}

// --- uploads ---------------------------------------------------------------

export function presignUpload(input: {
  kind: UploadKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  /** Required for "video" and "material": which course's 3 GB cap to check. */
  courseId?: string;
}): Promise<PresignUploadResponse> {
  return apiRequest<PresignUploadResponse>('/uploads/presign', { method: 'POST', body: input });
}

export function getSignedUrl(fileKey: string): Promise<SignedUrlResponse> {
  // The key contains slashes, which are part of the path by design.
  return apiRequest<SignedUrlResponse>(`/uploads/signed-url/${fileKey}`);
}
