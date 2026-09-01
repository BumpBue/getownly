import { Injectable } from '@nestjs/common';
import { CourseStatus, Prisma, Role } from '@prisma/client';
import {
  CourseNotFoundException,
  CourseNotVisibleException,
  CourseStorageLimitExceededException,
  LessonNotFoundException,
  NotCourseOwnerException,
} from '@/common/exceptions/catalog.exceptions';
import { NotEnrolledException } from '@/common/exceptions/learning.exceptions';
import { QnaAccessDeniedException } from '@/common/exceptions/qna.exceptions';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { COURSE_MAX_STORAGE_BYTES } from '@/modules/uploads/upload-rules';

/**
 * The second of the two permission layers described in CLAUDE.md, "Auth และสิทธิ์".
 *
 * `@Roles(INSTRUCTOR)` only proves someone is *an* instructor. Everything here
 * answers the question that actually matters: is this course, lesson or file
 * *theirs*, or are they allowed to read it. Every catalog service routes its
 * ownership check through this class so no endpoint can quietly skip one.
 */
@Injectable()
export class CourseAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws unless the user owns the course. Admins pass. */
  async assertCourseOwner(courseId: string, user: AuthenticatedUser): Promise<OwnedCourse> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        instructorId: true,
        status: true,
        title: true,
        price: true,
        storageUsedBytes: true,
      },
    });

    if (!course) {
      throw new CourseNotFoundException();
    }
    if (user.role !== Role.ADMIN && course.instructorId !== user.id) {
      throw new NotCourseOwnerException();
    }

    return course;
  }

  /**
   * Resolves a lesson for editing, checking the owning course in the same trip.
   */
  async assertLessonOwner(lessonId: string, user: AuthenticatedUser): Promise<OwnedLesson> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        courseId: true,
        videoKey: true,
        videoSize: true,
        orderIndex: true,
        course: { select: { instructorId: true, status: true, storageUsedBytes: true } },
      },
    });

    if (!lesson) {
      throw new LessonNotFoundException();
    }
    if (user.role !== Role.ADMIN && lesson.course.instructorId !== user.id) {
      throw new NotCourseOwnerException();
    }

    return lesson;
  }

  /**
   * Whether a course may be shown to this viewer.
   *
   * Anything other than PUBLISHED is visible to its instructor and to admins
   * only, and to everyone else it does not exist at all — a 404, not a 403,
   * so browsing ids reveals nothing.
   */
  assertCourseVisible(
    course: { instructorId: string; status: CourseStatus },
    user: AuthenticatedUser | null,
  ): void {
    if (course.status === CourseStatus.PUBLISHED) {
      return;
    }
    if (user && (user.role === Role.ADMIN || user.id === course.instructorId)) {
      return;
    }
    throw new CourseNotVisibleException();
  }

  /**
   * May this user watch this lesson's video / open its attachments?
   *
   * True for the course owner, for admins, for anyone enrolled, and for a
   * lesson the instructor marked as a free preview.
   */
  async canReadLessonContent(
    lesson: { isPreview: boolean; courseId: string; instructorId: string },
    user: AuthenticatedUser,
  ): Promise<boolean> {
    if (user.role === Role.ADMIN || lesson.instructorId === user.id || lesson.isPreview) {
      return true;
    }

    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId: lesson.courseId, studentId: user.id } },
      select: { id: true },
    });

    return enrollment !== null;
  }

  /**
   * Throws unless `addingBytes` more still fits under the 3 GB course cap
   * (scope 2.3.2), given `usedBytes` already spent.
   *
   * Called twice on the way to a stored file: once at presign time against
   * the client's claimed size, and again once StorageService.stat() reports
   * what actually landed — the same two-checkpoint pattern the per-file MIME
   * and size rules already use.
   */
  assertStorageAvailable(usedBytes: bigint, addingBytes: number): void {
    const projected = usedBytes + BigInt(addingBytes);
    if (projected > BigInt(COURSE_MAX_STORAGE_BYTES)) {
      const remaining = BigInt(COURSE_MAX_STORAGE_BYTES) - usedBytes;
      throw new CourseStorageLimitExceededException(
        Number(remaining > 0n ? remaining : 0n),
        addingBytes,
      );
    }
  }

  /**
   * Adjusts the cached storage total by a signed delta in bytes.
   *
   * The running total is the whole point: answering "is there room" must
   * never cost a fresh SUM over every video and material the course owns.
   */
  async adjustStorageUsage(courseId: string, deltaBytes: number): Promise<void> {
    if (deltaBytes === 0) {
      return;
    }
    await this.prisma.course.update({
      where: { id: courseId },
      data: { storageUsedBytes: { increment: BigInt(deltaBytes) } },
    });
  }

  /** Whether the viewer already owns the course, used to pick the detail page CTA. */
  async isEnrolled(courseId: string, userId: string): Promise<boolean> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: userId } },
      select: { id: true },
    });
    return enrollment !== null;
  }

  /**
   * Resolves the caller's enrolment, or refuses.
   *
   * Everything in the classroom hangs off the Enrollment row — progress is
   * recorded against it, and quiz attempts are only allowed through it — so
   * this returns the row rather than a boolean. Note that no role passes it:
   * an admin has not bought the course either.
   */
  async assertEnrolled(courseId: string, userId: string): Promise<EnrolledCourse> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { courseId_studentId: { courseId, studentId: userId } },
      select: { id: true, enrolledAt: true },
    });

    if (!enrollment) {
      throw new NotEnrolledException();
    }

    return enrollment;
  }

  /**
   * Who this person is, as far as one course's Q&A board is concerned.
   *
   * The board has three different audiences and they are not nested inside one
   * another: a student who paid may ask and answer, the instructor may answer
   * but has nobody to ask, and an admin may read and moderate without taking
   * part. Rather than three checks scattered across the service, every Q&A
   * route starts here and reads the answer off one object.
   *
   * Throws when the caller may not even read the board, so a caller that gets
   * a value back has already passed the outer gate.
   */
  async resolveQnaAccess(courseId: string, user: AuthenticatedUser): Promise<QnaAccess> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, title: true, instructorId: true },
    });

    if (!course) {
      throw new CourseNotFoundException();
    }

    const isInstructor = course.instructorId === user.id;
    const isAdmin = user.role === Role.ADMIN;
    const isEnrolled = await this.isEnrolled(courseId, user.id);

    if (!isInstructor && !isAdmin && !isEnrolled) {
      throw new QnaAccessDeniedException();
    }

    return {
      courseId: course.id,
      courseTitle: course.title,
      instructorId: course.instructorId,
      isInstructor,
      isAdmin,
      isEnrolled,
      canAsk: isEnrolled,
      canReply: isEnrolled || isInstructor,
    };
  }
}

export interface OwnedCourse {
  id: string;
  instructorId: string;
  status: CourseStatus;
  title: string;
  price: Prisma.Decimal;
  storageUsedBytes: bigint;
}

export interface EnrolledCourse {
  id: string;
  enrolledAt: Date;
}

/** What one person may do on one course's Q&A board. */
export interface QnaAccess {
  courseId: string;
  courseTitle: string;
  /** Needed to tell an instructor's reply from a student's. */
  instructorId: string;
  isInstructor: boolean;
  isAdmin: boolean;
  isEnrolled: boolean;
  canAsk: boolean;
  canReply: boolean;
}

export interface OwnedLesson {
  id: string;
  courseId: string;
  videoKey: string | null;
  videoSize: number | null;
  orderIndex: number;
  course: { instructorId: string; status: CourseStatus; storageUsedBytes: bigint };
}
