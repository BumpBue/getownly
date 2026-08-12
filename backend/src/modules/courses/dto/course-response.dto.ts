import type { CourseStatus } from '@prisma/client';

/**
 * Shapes that leave the API.
 *
 * Every one of these is built by an explicit mapper, never by returning a
 * Prisma row (CLAUDE.md, ข้อห้าม 11): an instructor's email must not ride
 * along on a public course card.
 */

export interface CourseInstructorDto {
  id: string;
  displayName: string;
  expertise: string | null;
}

export interface CourseCategoryDto {
  id: string;
  name: string;
  slug: string;
}

/** One card in the catalog grid. */
export interface CourseListItemDto {
  id: string;
  title: string;
  /** Fixed-point string, e.g. "1290.00". "0.00" means the course is free. */
  price: string;
  /** Short-lived signed URL, or null when the course has no cover yet. */
  coverUrl: string | null;
  instructor: CourseInstructorDto;
  category: CourseCategoryDto;
  lessonCount: number;
  totalDurationSec: number;
  enrollmentCount: number;
  publishedAt: string | null;
}

/** One row in the curriculum. Never carries a video key. */
export interface CourseLessonDto {
  id: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  isPreview: boolean;
  hasVideo: boolean;
  materialCount: number;
}

export interface CourseDetailDto extends CourseListItemDto {
  description: string;
  status: CourseStatus;
  /**
   * Why an admin sent the course back. Null for everyone but the owner and
   * admins: a rejection note is feedback, not public information.
   */
  rejectReason: string | null;
  lessons: CourseLessonDto[];
  /** True when the viewer already owns the course. Always false for guests. */
  isEnrolled: boolean;
  /** True when the viewer is the instructor who owns it, or an admin. */
  isOwner: boolean;
  createdAt: string;
}

/** A row in the instructor's own course table: every status, plus the reject note. */
export interface InstructorCourseDto {
  id: string;
  title: string;
  status: CourseStatus;
  price: string;
  coverUrl: string | null;
  category: CourseCategoryDto;
  lessonCount: number;
  enrollmentCount: number;
  rejectReason: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** What an instructor sees on their dashboard above the table. */
export interface InstructorStatsDto {
  totalCourses: number;
  publishedCourses: number;
  pendingCourses: number;
  draftCourses: number;
  totalStudents: number;
  totalLessons: number;
}

export interface PaginatedCoursesDto {
  items: CourseListItemDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --- admin review queue -----------------------------------------------------

/** The instructor as an admin needs to see them: with an address to reply to. */
export interface ReviewInstructorDto {
  id: string;
  displayName: string;
  email: string;
}

export interface ReviewLessonDto {
  id: string;
  title: string;
  orderIndex: number;
  durationSec: number | null;
  hasVideo: boolean;
}

/**
 * A course waiting for a decision.
 *
 * Carries the whole curriculum outline rather than a count, because approving
 * a course sight unseen is exactly what this queue exists to prevent.
 */
export interface PendingCourseDto {
  id: string;
  title: string;
  description: string;
  price: string;
  coverUrl: string | null;
  status: CourseStatus;
  rejectReason: string | null;
  instructor: ReviewInstructorDto;
  category: CourseCategoryDto;
  lessonCount: number;
  lessonsWithVideo: number;
  totalDurationSec: number;
  lessons: ReviewLessonDto[];
  /** When the instructor last touched it, which is when it entered the queue. */
  submittedAt: string;
  createdAt: string;
}

export interface PaginatedPendingCoursesDto {
  items: PendingCourseDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
