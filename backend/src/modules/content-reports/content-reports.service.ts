import { Injectable } from '@nestjs/common';
import { ContentReportStatus, ContentReportTargetType, CourseStatus, Prisma } from '@prisma/client';
import { CourseNotFoundException } from '@/common/exceptions/catalog.exceptions';
import {
  ContentReportAlreadyReviewedException,
  ContentReportNotFoundException,
} from '@/common/exceptions/content-report.exceptions';
import { QnaThreadNotFoundException } from '@/common/exceptions/qna.exceptions';
import type { AuthenticatedUser } from '@/common/types/authenticated-user';
import { PrismaService } from '@/infra/prisma.service';
import { CourseAccessService } from '@/modules/courses/course-access.service';
import type {
  CreateContentReportDto,
  ListContentReportsQueryDto,
  ReviewContentReportDto,
} from './dto/content-report-request.dto';
import type {
  ContentReportDto,
  PaginatedContentReportsDto,
} from './dto/content-report-response.dto';

const DEFAULT_PAGE_SIZE = 20;

const reportSelect = {
  id: true,
  targetType: true,
  targetId: true,
  reason: true,
  status: true,
  reviewedAt: true,
  createdAt: true,
  reporter: { select: { id: true, displayName: true } },
  reviewedBy: { select: { id: true, displayName: true } },
} satisfies Prisma.ContentReportSelect;

type ReportRow = Prisma.ContentReportGetPayload<{ select: typeof reportSelect }>;

/**
 * Reporting a course or a Q&A thread as inappropriate (scope 2.3.4).
 *
 * Creation is open to any signed-in role — the platform wants to hear about a
 * problem from whoever noticed it — but reporting a Q&A thread still runs
 * through {@link CourseAccessService.resolveQnaAccess}, the same gate that
 * decides who may read the thread at all: you cannot flag a conversation you
 * were never allowed to see.
 */
@Injectable()
export class ContentReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: CourseAccessService,
  ) {}

  async create(user: AuthenticatedUser, dto: CreateContentReportDto): Promise<{ message: string }> {
    if (dto.targetType === ContentReportTargetType.COURSE) {
      const course = await this.prisma.course.findUnique({
        where: { id: dto.targetId },
        select: { id: true },
      });
      if (!course) {
        throw new CourseNotFoundException();
      }
    } else {
      const thread = await this.prisma.qnaThread.findUnique({
        where: { id: dto.targetId },
        select: { id: true, courseId: true },
      });
      if (!thread) {
        throw new QnaThreadNotFoundException();
      }
      // Throws QnaAccessDeniedException for anyone who could not read this
      // board in the first place — enrolled students, the course's own
      // instructor, and admins all pass; a stranger does not.
      await this.access.resolveQnaAccess(thread.courseId, user);
    }

    await this.prisma.contentReport.create({
      data: {
        reporterId: user.id,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason.trim(),
      },
    });

    return { message: 'ส่งเรื่องแจ้งเรียบร้อยแล้ว ผู้ดูแลระบบจะตรวจสอบเร็วๆ นี้' };
  }

  /** The queue, oldest first — the one that has waited longest. */
  async listForAdmin(query: ListContentReportsQueryDto): Promise<PaginatedContentReportsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? DEFAULT_PAGE_SIZE;
    const where: Prisma.ContentReportWhereInput = query.status ? { status: query.status } : {};

    const [total, rows] = await Promise.all([
      this.prisma.contentReport.count({ where }),
      this.prisma.contentReport.findMany({
        where,
        select: reportSelect,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return {
      items: rows.map(toDto),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Records the decision and, only when asked and only for a course, hides it
   * from the catalog while the admin's decision stands.
   *
   * A report is judged once (`assertPending`): two admins racing the same
   * queue must not both act on it.
   */
  async review(
    reportId: string,
    admin: AuthenticatedUser,
    dto: ReviewContentReportDto,
  ): Promise<ContentReportDto> {
    const report = await this.prisma.contentReport.findUnique({
      where: { id: reportId },
      select: { id: true, status: true, targetType: true, targetId: true },
    });
    if (!report) {
      throw new ContentReportNotFoundException();
    }
    if (report.status !== ContentReportStatus.PENDING) {
      throw new ContentReportAlreadyReviewedException();
    }

    const shouldSuspendCourse =
      dto.status === 'REVIEWED' &&
      dto.suspendCourse === true &&
      report.targetType === ContentReportTargetType.COURSE;

    await this.prisma.$transaction(async (tx) => {
      await tx.contentReport.update({
        where: { id: reportId },
        data: {
          status: dto.status,
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      });

      if (shouldSuspendCourse) {
        // Suspend, not delete or unpublish: unpublish is the instructor's own
        // choice and carries different wording, and every buyer's Enrollment
        // keeps working regardless — access is checked there, not here.
        await tx.course.update({
          where: { id: report.targetId },
          data: { status: CourseStatus.SUSPENDED },
        });
      }
    });

    const updated = await this.prisma.contentReport.findUniqueOrThrow({
      where: { id: reportId },
      select: reportSelect,
    });
    return toDto(updated);
  }
}

function toDto(row: ReportRow): ContentReportDto {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    reason: row.reason,
    status: row.status,
    reporter: row.reporter,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
