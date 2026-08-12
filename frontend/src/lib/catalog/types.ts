/**
 * The catalog shapes the API returns.
 *
 * Re-exported from @getownly/shared rather than declared here a second
 * time: these interfaces mirror backend/src/modules/courses/dto/course-response.dto.ts
 * and backend/src/modules/lessons/dto/lesson-response.dto.ts byte for byte,
 * and packages/shared/src/catalog.ts is where that now lives once. When one
 * side changes, change packages/shared and the backend DTO in the same commit.
 *
 * Two fields are deliberately missing everywhere: `coverKey` and `videoKey`.
 * Object keys stay on the server; covers arrive as a signed `coverUrl`, and
 * lesson video only ever arrives as bytes from GET /lessons/:id/stream.
 */

import {
  COURSE_SORTS,
  COURSE_STATUSES,
  UPLOAD_ACCEPT,
  UPLOAD_KINDS,
  UPLOAD_MAX_MB,
  type Category,
  type CourseCategory,
  type CourseDetail,
  type CourseInstructor,
  type CourseLesson,
  type CourseListItem,
  type CourseSort,
  type CourseStatus,
  type InstructorCourse,
  type InstructorStats,
  type Lesson,
  type Material,
  type PaginatedCourses,
  type PresignUploadResponse,
  type SignedUrlResponse,
  type UploadKind,
} from "@getownly/shared";

export { COURSE_SORTS, COURSE_STATUSES, UPLOAD_ACCEPT, UPLOAD_KINDS, UPLOAD_MAX_MB };
export type {
  Category,
  CourseCategory,
  CourseDetail,
  CourseInstructor,
  CourseLesson,
  CourseListItem,
  CourseSort,
  CourseStatus,
  InstructorCourse,
  InstructorStats,
  Lesson,
  Material,
  PaginatedCourses,
  PresignUploadResponse,
  SignedUrlResponse,
  UploadKind,
};

/** Filter state the catalog page keeps in the URL - not part of any API response. */
export interface CourseFilterState {
  search: string;
  categoryId: string;
  minPrice: string;
  maxPrice: string;
  freeOnly: boolean;
  sort: CourseSort;
  page: number;
}
