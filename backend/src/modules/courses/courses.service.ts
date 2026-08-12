import { Injectable } from '@nestjs/common';
import { CourseStatus, Prisma, Role } from '@prisma/client';
import {
  CategoryNotFoundException,
  CourseIncompleteException,
  CourseNotDeletableException,
  CourseNotEditableException,
  CourseNotFoundException,
  CourseNotSubmittableException,
} from '@/common/exceptions/catalog.exceptions';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { StorageService } from '@/infra/storage/storage.service';
import { CourseAccessService } from './course-access.service';
import type {
  CreateCourseDto,
  ListCoursesQueryDto,
  UpdateCourseDto,
} from './dto/course-request.dto';
import type {
  CourseDetailDto,
  CourseListItemDto,
  InstructorCourseDto,
  InstructorStatsDto,
  PaginatedCoursesDto,
} from './dto/course-response.dto';

const DEFAULT_PAGE_SIZE = 12;

/** Editing is blocked only while an admin is actually looking at the course. */
const LOCKED_FOR_EDIT: CourseStatus[] = [CourseStatus.PENDING_REVIEW];

/** A rejected course can be fixed and sent back in. */
const SUBMITTABLE_FROM: CourseStatus[] = [CourseStatus.DRAFT, CourseStatus.REJECTED];

const listSelect = {
  id: true,
  title: true,
  price: true,
  coverKey: true,
  publishedAt: true,
  instructor: { select: { id: true, displayName: true, expertise: true } },
  category: { select: { id: true, name: true, slug: true } },
  lessons: { select: { durationSec: true } },
  _count: { select: { enrollments: true } },
} satisfies Prisma.CourseSelect;

type CourseListRow = Prisma.CourseGetPayload<{ select: typeof listSelect }>;

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly access: CourseAccessService,
  ) {}

  // -------------------------------------------------------------------------
  // Public catalog
  // -------------------------------------------------------------------------

  /**
   * The public grid. Only ever returns PUBLISHED courses: a draft must not be
   * discoverable, no matter what the query asks for.
   */
  async listPublished(query: ListCoursesQueryDto): Promise<PaginatedCoursesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where = buildCatalogFilter(query);

    const [total, rows] = await Promise.all([
      this.prisma.course.count({ where }),
      this.prisma.course.findMany({
        where,
        select: listSelect,
        orderBy: buildOrderBy(query.sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: await this.toListItems(rows),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Course detail. Anything not PUBLISHED is a 404 for everyone except its
   * instructor and admins, so nothing leaks through a guessed id.
   */
  async findOne(courseId: string, viewer: AuthenticatedUser | null): Promise<CourseDetailDto> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        ...listSelect,
        description: true,
        status: true,
        rejectReason: true,
        instructorId: true,
        createdAt: true,
        lessons: {
          select: {
            id: true,
            title: true,
            orderIndex: true,
            durationSec: true,
            isPreview: true,
            videoKey: true,
            _count: { select: { materials: true } },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });

    if (!course) {
      throw new CourseNotFoundException();
    }

    this.access.assertCourseVisible(course, viewer);

    const isOwner =
      viewer !== null && (viewer.role === Role.ADMIN || viewer.id === course.instructorId);
    const isEnrolled = viewer !== null && (await this.access.isEnrolled(courseId, viewer.id));

    return {
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price.toFixed(2),
      coverUrl: await this.signCover(course.coverKey),
      status: course.status,
      rejectReason: isOwner ? course.rejectReason : null,
      instructor: course.instructor,
      category: course.category,
      lessonCount: course.lessons.length,
      totalDurationSec: sumDuration(course.lessons),
      enrollmentCount: course._count.enrollments,
      publishedAt: course.publishedAt?.toISOString() ?? null,
      createdAt: course.createdAt.toISOString(),
      isEnrolled,
      isOwner,
      lessons: course.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        orderIndex: lesson.orderIndex,
        durationSec: lesson.durationSec,
        isPreview: lesson.isPreview,
        // The key itself never leaves; only whether there is one.
        hasVideo: lesson.videoKey !== null,
        materialCount: lesson._count.materials,
      })),
    };
  }

  // -------------------------------------------------------------------------
  // Instructor
  // -------------------------------------------------------------------------

  /** Every course this instructor owns, in every status. */
  async listMine(user: AuthenticatedUser): Promise<InstructorCourseDto[]> {
    const rows = await this.prisma.course.findMany({
      where: { instructorId: user.id },
      select: {
        id: true,
        title: true,
        status: true,
        price: true,
        coverKey: true,
        rejectReason: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { lessons: true, enrollments: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        price: row.price.toFixed(2),
        coverUrl: await this.signCover(row.coverKey),
        category: row.category,
        lessonCount: row._count.lessons,
        enrollmentCount: row._count.enrollments,
        rejectReason: row.rejectReason,
        publishedAt: row.publishedAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    );
  }

  /** The numbers on the instructor dashboard cards. */
  async statsFor(user: AuthenticatedUser): Promise<InstructorStatsDto> {
    const [byStatus, totals] = await Promise.all([
      this.prisma.course.groupBy({
        by: ['status'],
        where: { instructorId: user.id },
        _count: { _all: true },
      }),
      this.prisma.course.findMany({
        where: { instructorId: user.id },
        select: { _count: { select: { lessons: true, enrollments: true } } },
      }),
    ]);

    const countOf = (status: CourseStatus): number =>
      byStatus.find((row) => row.status === status)?._count._all ?? 0;

    return {
      totalCourses: totals.length,
      publishedCourses: countOf(CourseStatus.PUBLISHED),
      pendingCourses: countOf(CourseStatus.PENDING_REVIEW),
      draftCourses: countOf(CourseStatus.DRAFT),
      // One enrollment is one seat sold; the same person on two courses counts twice.
      totalStudents: totals.reduce((sum, row) => sum + row._count.enrollments, 0),
      totalLessons: totals.reduce((sum, row) => sum + row._count.lessons, 0),
    };
  }

  async create(user: AuthenticatedUser, dto: CreateCourseDto): Promise<CourseDetailDto> {
    await this.assertCategoryExists(dto.categoryId);

    const course = await this.prisma.course.create({
      data: {
        // The owner comes from the token, never from the body (ข้อห้าม 7).
        instructorId: user.id,
        categoryId: dto.categoryId,
        title: dto.title.trim(),
        description: dto.description.trim(),
        price: new Prisma.Decimal(dto.price ?? '0'),
        coverKey: dto.coverKey ?? null,
        status: CourseStatus.DRAFT,
      },
      select: { id: true },
    });

    return this.findOne(course.id, user);
  }

  async update(
    courseId: string,
    user: AuthenticatedUser,
    dto: UpdateCourseDto,
  ): Promise<CourseDetailDto> {
    const course = await this.access.assertCourseOwner(courseId, user);

    if (LOCKED_FOR_EDIT.includes(course.status)) {
      throw new CourseNotEditableException(course.status);
    }
    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId);
    }

    const previousCoverKey = await this.coverKeyOf(courseId);

    // Content can change freely on a course already selling, but the number
    // buyers are charged cannot - a price edit sends it back to the review
    // queue, the same as a brand-new submission (PLAN.md ข้อ 1.2).
    const nextPrice = dto.price !== undefined ? new Prisma.Decimal(dto.price) : undefined;
    const priceChanged =
      nextPrice !== undefined &&
      course.status === CourseStatus.PUBLISHED &&
      !nextPrice.equals(course.price);

    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(nextPrice !== undefined ? { price: nextPrice } : {}),
        ...(dto.coverKey !== undefined ? { coverKey: dto.coverKey } : {}),
        ...(priceChanged ? { status: CourseStatus.PENDING_REVIEW } : {}),
      },
    });

    // The old cover has no other reference once the row points elsewhere.
    if (dto.coverKey !== undefined && previousCoverKey && previousCoverKey !== dto.coverKey) {
      await this.storage.remove(previousCoverKey);
    }

    return this.findOne(courseId, user);
  }

  /**
   * Deletable only while it is a draft nobody has bought.
   *
   * A course with enrollments can never be deleted, because students paid for
   * access to it and OrderItem-style history must keep pointing somewhere real.
   */
  async remove(courseId: string, user: AuthenticatedUser): Promise<{ message: string }> {
    const course = await this.access.assertCourseOwner(courseId, user);

    if (course.status !== CourseStatus.DRAFT) {
      throw new CourseNotDeletableException('STATUS', course.status);
    }

    const enrollmentCount = await this.prisma.enrollment.count({ where: { courseId } });
    if (enrollmentCount > 0) {
      throw new CourseNotDeletableException('HAS_ENROLLMENTS', course.status);
    }

    // Collect the keys before the cascade takes the rows with it.
    const [lessons, materials, coverKey] = await Promise.all([
      this.prisma.lesson.findMany({ where: { courseId }, select: { videoKey: true } }),
      this.prisma.material.findMany({ where: { lesson: { courseId } }, select: { fileKey: true } }),
      this.coverKeyOf(courseId),
    ]);

    await this.prisma.course.delete({ where: { id: courseId } });

    // Best effort, and after the delete on purpose: a storage hiccup must not
    // leave a course row the user was told is gone.
    const orphaned = [
      coverKey,
      ...lessons.map((lesson) => lesson.videoKey),
      ...materials.map((material) => material.fileKey),
    ].filter((key): key is string => key !== null);

    await Promise.all(orphaned.map((key) => this.storage.remove(key)));

    return { message: 'ลบคอร์สเรียบร้อยแล้ว' };
  }

  /**
   * Hands the course to the admin review queue.
   *
   * The checklist runs here rather than in the DTO because it spans rows: a
   * course is only complete once it has a cover and at least one lesson.
   */
  async submitForReview(courseId: string, user: AuthenticatedUser): Promise<CourseDetailDto> {
    const course = await this.access.assertCourseOwner(courseId, user);

    if (!SUBMITTABLE_FROM.includes(course.status)) {
      throw new CourseNotSubmittableException(course.status);
    }

    const detail = await this.prisma.course.findUniqueOrThrow({
      where: { id: courseId },
      select: {
        coverKey: true,
        description: true,
        _count: { select: { lessons: true } },
      },
    });

    const missing: string[] = [];
    if (!detail.coverKey) {
      missing.push('ภาพหน้าปกคอร์ส');
    }
    if (detail._count.lessons === 0) {
      missing.push('บทเรียนอย่างน้อย 1 บท');
    }
    if (detail.description.trim().length < 20) {
      missing.push('คำอธิบายคอร์ส');
    }
    if (missing.length > 0) {
      throw new CourseIncompleteException(missing);
    }

    await this.prisma.course.update({
      where: { id: courseId },
      data: {
        status: CourseStatus.PENDING_REVIEW,
        // The previous rejection no longer describes the current submission.
        rejectReason: null,
      },
    });

    return this.findOne(courseId, user);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async assertCategoryExists(categoryId: string): Promise<void> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new CategoryNotFoundException();
    }
  }

  private async coverKeyOf(courseId: string): Promise<string | null> {
    const row = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { coverKey: true },
    });
    return row?.coverKey ?? null;
  }

  private toListItems(rows: CourseListRow[]): Promise<CourseListItemDto[]> {
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        title: row.title,
        price: row.price.toFixed(2),
        coverUrl: await this.signCover(row.coverKey),
        instructor: row.instructor,
        category: row.category,
        lessonCount: row.lessons.length,
        totalDurationSec: sumDuration(row.lessons),
        enrollmentCount: row._count.enrollments,
        publishedAt: row.publishedAt?.toISOString() ?? null,
      })),
    );
  }

  /**
   * A cover is a signed URL that expires, so it is minted per response.
   * A storage outage costs a placeholder image, not a failed page.
   */
  private signCover(coverKey: string | null): Promise<string | null> {
    return this.storage.presignGetOrNull(coverKey);
  }
}

// ---------------------------------------------------------------------------
// Query building
// ---------------------------------------------------------------------------

function buildCatalogFilter(query: ListCoursesQueryDto): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = { status: CourseStatus.PUBLISHED };

  if (query.search) {
    // Thai has no case, but `insensitive` keeps the English course titles
    // (Maya, Python) matching however the visitor typed them.
    where.OR = [
      { title: { contains: query.search, mode: 'insensitive' } },
      { description: { contains: query.search, mode: 'insensitive' } },
    ];
  }

  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  // "Free only" is an exact price, so it overrides any range that came with it.
  if (query.freeOnly) {
    where.price = new Prisma.Decimal(0);
    return where;
  }

  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.price = {
      ...(query.minPrice !== undefined ? { gte: new Prisma.Decimal(query.minPrice) } : {}),
      ...(query.maxPrice !== undefined ? { lte: new Prisma.Decimal(query.maxPrice) } : {}),
    };
  }

  return where;
}

function buildOrderBy(sort: ListCoursesQueryDto['sort']): Prisma.CourseOrderByWithRelationInput[] {
  switch (sort) {
    case 'popular':
      return [{ enrollments: { _count: 'desc' } }, { publishedAt: 'desc' }];
    case 'price_asc':
      return [{ price: 'asc' }, { publishedAt: 'desc' }];
    case 'price_desc':
      return [{ price: 'desc' }, { publishedAt: 'desc' }];
    case 'latest':
    default:
      // createdAt breaks ties among courses published in the same seed run.
      return [{ publishedAt: 'desc' }, { createdAt: 'desc' }];
  }
}

function sumDuration(lessons: { durationSec: number | null }[]): number {
  return lessons.reduce((total, lesson) => total + (lesson.durationSec ?? 0), 0);
}
