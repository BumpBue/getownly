import { Injectable } from '@nestjs/common';
import { CourseStatus, Prisma } from '@prisma/client';
import { CourseNotUnderReviewException } from '@/common/exceptions/admin.exceptions';
import { CourseNotFoundException } from '@/common/exceptions/catalog.exceptions';
import { PrismaService } from '@/infra/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import type { ListPendingCoursesQueryDto } from './dto/course-request.dto';
import type { PendingCourseDto, PaginatedPendingCoursesDto } from './dto/course-response.dto';

const DEFAULT_PAGE_SIZE = 10;

/** Enough for an admin to judge a course without opening it. */
const reviewSelect = {
  id: true,
  title: true,
  description: true,
  price: true,
  coverKey: true,
  status: true,
  rejectReason: true,
  createdAt: true,
  updatedAt: true,
  instructor: { select: { id: true, displayName: true, email: true } },
  category: { select: { id: true, name: true, slug: true } },
  lessons: {
    select: { id: true, title: true, orderIndex: true, durationSec: true, videoKey: true },
    orderBy: { orderIndex: 'asc' },
  },
} satisfies Prisma.CourseSelect;

type ReviewRow = Prisma.CourseGetPayload<{ select: typeof reviewSelect }>;

/**
 * The gate between a course being written and a course being sold.
 *
 * Separate from CoursesService because the two answer to different people: that
 * one serves instructors editing their own work, this one serves an admin
 * deciding whether the platform will carry it. Sharing a class would mean one
 * file where "may I touch this course" has two different answers.
 */
@Injectable()
export class CourseReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** The queue, oldest submission first — the one that has waited longest. */
  async listPending(query: ListPendingCoursesQueryDto): Promise<PaginatedPendingCoursesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.CourseWhereInput = { status: CourseStatus.PENDING_REVIEW };

    const [total, rows] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        select: reviewSelect,
        orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: await Promise.all(rows.map((row) => this.toPendingCourse(row))),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** PENDING_REVIEW → PUBLISHED. The moment a course becomes buyable. */
  async approve(courseId: string): Promise<PendingCourseDto> {
    await this.assertUnderReview(courseId);

    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: {
        status: CourseStatus.PUBLISHED,
        publishedAt: new Date(),
        // A previous rejection is answered by this approval; leaving the note
        // behind would keep showing the instructor a complaint already fixed.
        rejectReason: null,
      },
      select: reviewSelect,
    });

    return this.toPendingCourse(course);
  }

  /**
   * PENDING_REVIEW → REJECTED, with a reason.
   *
   * The reason is required by the DTO because a rejection without one leaves
   * the instructor with nothing to act on, and they can edit and resubmit
   * from REJECTED.
   */
  async reject(courseId: string, reason: string): Promise<PendingCourseDto> {
    await this.assertUnderReview(courseId);

    const course = await this.prisma.course.update({
      where: { id: courseId },
      data: { status: CourseStatus.REJECTED, rejectReason: reason.trim() },
      select: reviewSelect,
    });

    return this.toPendingCourse(course);
  }

  private async assertUnderReview(courseId: string): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { status: true },
    });

    if (!course) {
      throw new CourseNotFoundException();
    }
    // Two admins with the queue open would otherwise both "approve" it, and
    // the second would quietly re-publish something the first had rejected.
    if (course.status !== CourseStatus.PENDING_REVIEW) {
      throw new CourseNotUnderReviewException(course.status);
    }
  }

  private async toPendingCourse(course: ReviewRow): Promise<PendingCourseDto> {
    return {
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price.toFixed(2),
      coverUrl: await this.storage.presignGetOrNull(course.coverKey),
      status: course.status,
      rejectReason: course.rejectReason,
      instructor: course.instructor,
      category: course.category,
      lessonCount: course.lessons.length,
      lessonsWithVideo: course.lessons.filter((lesson) => lesson.videoKey !== null).length,
      totalDurationSec: course.lessons.reduce(
        (total, lesson) => total + (lesson.durationSec ?? 0),
        0,
      ),
      lessons: course.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        orderIndex: lesson.orderIndex,
        durationSec: lesson.durationSec,
        hasVideo: lesson.videoKey !== null,
      })),
      submittedAt: course.updatedAt.toISOString(),
      createdAt: course.createdAt.toISOString(),
    };
  }
}
