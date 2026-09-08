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
  type LessonQuizSummary,
  type Material,
  type Quiz,
  type QuizChoice,
  type QuizInput,
  type QuizQuestion,
  type QuizQuestionInput,
  type PaginatedCourses,
  type PresignUploadResponse,
  type SignedUrlResponse,
  type UploadKind,
} from "@getownly/shared";

export { COURSE_SORTS, COURSE_STATUSES, UPLOAD_ACCEPT, UPLOAD_KINDS, UPLOAD_MAX_MB };

/**
 * How one student stands on one quiz (ทก.01 A9).
 *
 * `bestScore: null` means never attempted, which is not the same as scoring
 * zero — the roster shows "ยังไม่ทำ" for one and "0%" for the other.
 */
export interface CourseStudentQuiz {
  quizId: string;
  lessonId: string;
  lessonTitle: string;
  quizTitle: string;
  passScore: number;
  bestScore: number | null;
  hasPassed: boolean;
  attemptCount: number;
}

/**
 * One row of the roster. Carries no email or other contact detail: the scope
 * grants an instructor the right to see who is enrolled and how they are
 * getting on, not a way to reach them.
 */
export interface CourseStudent {
  enrollmentId: string;
  studentId: string;
  displayName: string;
  enrolledAt: string;
  lessonCount: number;
  completedLessonCount: number;
  progressPercent: number;
  passedQuizCount: number;
  quizCount: number;
  quizzes: CourseStudentQuiz[];
}

export interface PaginatedCourseStudents {
  items: CourseStudent[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  lessonCount: number;
  quizCount: number;
}
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
  LessonQuizSummary,
  Material,
  Quiz,
  QuizChoice,
  QuizInput,
  QuizQuestion,
  QuizQuestionInput,
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
