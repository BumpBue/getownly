import type { CourseStatus } from './enums';
import type { MoneyString } from './api';

/**
 * Catalog shapes the API returns and the web app consumes.
 *
 * Mirrors backend/src/modules/courses/dto/course-response.dto.ts. When one
 * side changes, change the other in the same commit.
 *
 * Two things are deliberately absent from every shape here: `videoKey` and
 * `coverKey`. Object keys stay on the server — covers arrive as a short-lived
 * signed `coverUrl`, and lesson video only ever arrives as bytes from
 * GET /lessons/:id/stream.
 */

export const COURSE_SORTS = ['latest', 'popular', 'price_asc', 'price_desc'] as const;
export type CourseSort = (typeof COURSE_SORTS)[number];

export const COURSE_SORT_LABEL_TH: Record<CourseSort, string> = {
  latest: 'ใหม่ล่าสุด',
  popular: 'ยอดนิยม',
  price_asc: 'ราคาน้อยไปมาก',
  price_desc: 'ราคามากไปน้อย',
};

export interface CourseInstructor {
  id: string;
  displayName: string;
  expertise: string | null;
}

export interface CourseCategory {
  id: string;
  name: string;
  slug: string;
}

export interface Category extends CourseCategory {
  courseCount: number;
}

export interface CourseListItem {
  id: string;
  title: string;
  price: MoneyString;
  coverUrl: string | null;
  instructor: CourseInstructor;
  category: CourseCategory;
  lessonCount: number;
  totalDurationSec: number;
  enrollmentCount: number;
  publishedAt: string | null;
}

export interface CourseLesson {
  id: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  isPreview: boolean;
  hasVideo: boolean;
  materialCount: number;
}

export interface CourseDetail extends CourseListItem {
  description: string;
  status: CourseStatus;
  /** Null unless the viewer owns the course: a rejection note is feedback, not public. */
  rejectReason: string | null;
  lessons: CourseLesson[];
  isEnrolled: boolean;
  isOwner: boolean;
  createdAt: string;
}

export interface InstructorCourse {
  id: string;
  title: string;
  status: CourseStatus;
  price: MoneyString;
  coverUrl: string | null;
  category: CourseCategory;
  lessonCount: number;
  enrollmentCount: number;
  rejectReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstructorStats {
  totalCourses: number;
  publishedCourses: number;
  pendingCourses: number;
  draftCourses: number;
  totalStudents: number;
  totalLessons: number;
}

export interface PaginatedCourses {
  items: CourseListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Material {
  id: string;
  lessonId: string;
  fileName: string;
  fileKey: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

/** A lesson as its instructor edits it, attachments included. */
export interface Lesson {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  isPreview: boolean;
  hasVideo: boolean;
  materials: Material[];
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export const UPLOAD_KINDS = ['video', 'material', 'cover', 'avatar', 'slip'] as const;
export type UploadKind = (typeof UPLOAD_KINDS)[number];

export interface PresignUploadResponse {
  uploadUrl: string;
  fileKey: string;
  expiresIn: number;
}

export interface SignedUrlResponse {
  url: string;
  expiresIn: number;
}

/**
 * Accepted MIME types per kind, mirroring backend/src/modules/uploads/upload-rules.ts.
 * Used for the `accept` attribute on file inputs and to fail fast before a
 * pointless round trip — the server still decides.
 */
export const UPLOAD_ACCEPT: Record<UploadKind, string[]> = {
  video: ['video/mp4', 'video/webm'],
  material: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed',
  ],
  cover: ['image/jpeg', 'image/png', 'image/webp'],
  avatar: ['image/jpeg', 'image/png', 'image/webp'],
  slip: ['image/jpeg', 'image/png'],
};

/** Size ceilings in megabytes, matching the UPLOAD_MAX_* values in .env. */
export const UPLOAD_MAX_MB: Record<UploadKind, number> = {
  video: 500,
  material: 50,
  cover: 5,
  avatar: 5,
  slip: 5,
};
