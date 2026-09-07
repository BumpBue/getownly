import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListCourseStudentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100, { message: 'ขอข้อมูลได้ครั้งละไม่เกิน 100 รายการ' })
  limit?: number;
}

/**
 * How one student stands on one quiz.
 *
 * `bestScore` is null when they have never sat it, and that is a different
 * fact from having sat it and scored nothing: "ยังไม่ทำ" and "0%" mean
 * opposite things to an instructor deciding whether a lesson is landing.
 */
export interface CourseStudentQuizDto {
  quizId: string;
  lessonId: string;
  lessonTitle: string;
  quizTitle: string;
  passScore: number;
  /** Highest score across every attempt, or null if never attempted. */
  bestScore: number | null;
  /** Whether that best score cleared passScore. False while never attempted. */
  hasPassed: boolean;
  attemptCount: number;
}

/**
 * One row of the roster an instructor reads (ทก.01 A9).
 *
 * Deliberately without an email address or any other way to contact the
 * person: the scope grants an instructor the right to *see who is enrolled and
 * how they are doing*, which this answers in full without handing over
 * anybody's contact details.
 */
export interface CourseStudentDto {
  enrollmentId: string;
  studentId: string;
  displayName: string;
  enrolledAt: string;
  lessonCount: number;
  completedLessonCount: number;
  /** The same number the student is shown; see common/progress.ts. */
  progressPercent: number;
  /** How many of the course's quizzes this student has cleared. */
  passedQuizCount: number;
  quizCount: number;
  /** Every quiz in the course, including ones this student has not sat. */
  quizzes: CourseStudentQuizDto[];
}

export interface PaginatedCourseStudentsDto {
  items: CourseStudentDto[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  /** Lessons in the course, repeated here so an empty page still knows it. */
  lessonCount: number;
  quizCount: number;
}
